const crypto = require('crypto');

/**
 * Field-level encryption for identifiers we are obliged to hold but should
 * never store readable — currently Aadhaar and PAN on rental bookings.
 *
 * AES-256-GCM. The key comes from FIELD_ENCRYPTION_KEY (64 hex chars, i.e.
 * 32 bytes); generate one with:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Losing the key makes existing ciphertext unreadable, so keep it with your
 * other secrets and never rotate it without re-encrypting.
 *
 * Values are stored as  enc:v1:<iv>:<authTag>:<ciphertext>  all base64url.
 * The prefix lets decrypt() pass through plaintext written before this
 * existed, so old bookings keep rendering.
 */
const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

let cachedKey = null;
const getKey = () => {
  if (cachedKey) return cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), 'hex');
  if (key.length !== 32) {
    console.error('FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Field encryption is disabled.');
    return null;
  }
  cachedKey = key;
  return key;
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

const encrypt = (plain) => {
  if (plain === null || plain === undefined || plain === '') return plain;
  const text = String(plain);
  if (isEncrypted(text)) return text;

  const key = getKey();
  if (!key) {
    // Fail loud in production; in development let the app run unencrypted so a
    // missing key does not block local work.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FIELD_ENCRYPTION_KEY is not set - refusing to store identity documents in plain text.');
    }
    console.warn('FIELD_ENCRYPTION_KEY not set - storing KYC field unencrypted (development only).');
    return text;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, enc].map((b) => b.toString('base64url')).join(':');
};

const decrypt = (value) => {
  if (!isEncrypted(value)) return value;
  const key = getKey();
  if (!key) return null;

  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.error('Field decryption failed ->', err.message);
    return null;
  }
};

/** Show only what is needed to recognise a document: "XXXXXXXX1234". */
const mask = (plain, visible = 4) => {
  if (!plain) return null;
  const s = String(plain);
  if (s.length <= visible) return 'X'.repeat(s.length);
  return 'X'.repeat(s.length - visible) + s.slice(-visible);
};

/** Decrypt then mask - what an admin list should show. */
const maskEncrypted = (value, visible = 4) => {
  const plain = decrypt(value);
  return plain ? mask(plain, visible) : null;
};

module.exports = { encrypt, decrypt, mask, maskEncrypted, isEncrypted };
