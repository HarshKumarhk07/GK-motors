/**
 * Input validation and sanitisation.
 *
 * Hand-rolled rather than pulled from a library on purpose: the npm registry
 * is not reachable from this environment, and adding a dependency would mean a
 * package.json/lockfile change that cannot be verified with an install.
 * Everything below is small, dependency-free and testable.
 *
 * Two rules shape the module:
 *
 *   1. Sanitise for shape, do not reject. Markup is stripped and whitespace
 *      collapsed rather than failing the request, so a customer with an
 *      apostrophe in their name or a stray newline in an address is never
 *      blocked. Only genuinely unusable values -- a missing required field, a
 *      malformed email, an out-of-range number -- raise.
 *
 *   2. This is the security boundary. The matching client helpers exist for
 *      fast feedback, not for safety; every rule that matters is enforced
 *      here, where a crafted request cannot skip it.
 */

/**
 * A validation failure the error handler renders as a 400.
 *
 * The controllers' convention is `res.status(400); throw new Error()`, which
 * needs the response object. Helpers do not have one, so they carry the status
 * on the error instead and errorHandler reads `err.status`.
 */
class InvalidInput extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidInput';
    this.status = 400;
    this.expose = true;
  }
}

/* A tag is only stripped when a letter follows the angle bracket, so "<b>" and
   "</script>" go while ordinary prose like "5 < 6 and 7 > 2" survives intact.
   A blunt /<[^>]*>/ would eat that sentence. */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Is this code point one we refuse to store?
 *
 * Tested numerically rather than with a character-class regex so this file
 * stays plain ASCII and each range can be named.
 *
 *   0-8, 11-12, 14-31, 127-159  C0/C1 controls. Tab (9) and newline (10) are
 *                               deliberately allowed: multi-line input needs
 *                               them, and cleanText collapses them anyway.
 *   0x200B-0x200F               zero-width space/joiners and LTR/RTL marks
 *   0x202A-0x202E               bidi overrides -- invisible, and usable to
 *                               make stored text render misleadingly
 *   0x2060-0x2064               word joiner and invisible operators
 *   0xFEFF                      byte-order mark
 */
const isUnprintable = (code) =>
  code <= 8
  || code === 11
  || code === 12
  || (code >= 14 && code <= 31)
  || (code >= 127 && code <= 159)
  || (code >= 0x200b && code <= 0x200f)
  || (code >= 0x202a && code <= 0x202e)
  || (code >= 0x2060 && code <= 0x2064)
  || code === 0xfeff;

const stripUnprintable = (text) => {
  let out = '';
  for (const ch of text) {
    if (!isUnprintable(ch.codePointAt(0))) out += ch;
  }
  return out;
};

/** Remove markup and anything unprintable. Never throws. */
const stripTags = (value) =>
  stripUnprintable(
    String(value ?? '').replace(HTML_COMMENT, '').replace(HTML_TAG, '')
  );

const label = (field) => field || 'This field';

/**
 * A single-line text value: markup removed, whitespace collapsed, trimmed.
 *
 * `required` decides whether an empty result raises or returns '', so optional
 * fields can share the same call.
 */
const cleanText = (value, { field, min = 0, max = 500, required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new InvalidInput(`${label(field)} is required`);
    return '';
  }

  const cleaned = stripTags(value).replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    if (required) throw new InvalidInput(`${label(field)} is required`);
    return '';
  }
  if (cleaned.length < min) throw new InvalidInput(`${label(field)} must be at least ${min} characters`);
  if (cleaned.length > max) throw new InvalidInput(`${label(field)} cannot exceed ${max} characters`);
  return cleaned;
};

/**
 * Multi-line text -- messages, notes, problem descriptions.
 *
 * Same cleaning, but newlines survive (runs of three or more collapse to one
 * blank line) so a customer's paragraphs are not flattened into a single line.
 */
const cleanMultiline = (value, { field, min = 0, max = 2000, required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new InvalidInput(`${label(field)} is required`);
    return '';
  }

  const cleaned = stripTags(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) {
    if (required) throw new InvalidInput(`${label(field)} is required`);
    return '';
  }
  if (cleaned.length < min) throw new InvalidInput(`${label(field)} must be at least ${min} characters`);
  if (cleaned.length > max) throw new InvalidInput(`${label(field)} cannot exceed ${max} characters`);
  return cleaned;
};

/* Deliberately permissive: one @, no spaces, a dot in the domain. Stricter
   patterns reject valid addresses, and the only real proof an address works is
   a message arriving at it. 254 is the RFC 5321 maximum. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const cleanEmail = (value, { field = 'Email', required = false } = {}) => {
  const raw = stripTags(value).trim().toLowerCase();
  if (!raw) {
    if (required) throw new InvalidInput(`${field} is required`);
    return '';
  }
  if (raw.length > 254 || !EMAIL_RE.test(raw)) {
    throw new InvalidInput('That email address does not look right');
  }
  return raw;
};

/**
 * Phone number. Punctuation a person might type is discarded rather than
 * rejected, so "+91 92536-25099" and "9253625099" both go in cleanly.
 */
const cleanPhone = (value, { field = 'Phone number', required = false } = {}) => {
  const raw = stripTags(value).replace(/[\s()-]/g, '').trim();
  if (!raw) {
    if (required) throw new InvalidInput(`${field} is required`);
    return '';
  }
  if (!/^\+?\d{7,15}$/.test(raw)) throw new InvalidInput('That phone number does not look right');
  return raw;
};

/** Indian PIN: six digits, never starting with zero. */
const cleanPincode = (value, { field = 'Pincode', required = true } = {}) => {
  const raw = stripTags(value).replace(/\s/g, '').trim();
  if (!raw) {
    if (required) throw new InvalidInput(`${field} is required`);
    return '';
  }
  if (!/^[1-9]\d{5}$/.test(raw)) {
    throw new InvalidInput('Pincode must be 6 digits and cannot start with 0');
  }
  return raw;
};

const cleanInt = (value, { field, min, max, required = false, fallback } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new InvalidInput(`${label(field)} is required`);
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new InvalidInput(`${label(field)} must be a whole number`);
  }
  if (min !== undefined && n < min) throw new InvalidInput(`${label(field)} must be at least ${min}`);
  if (max !== undefined && n > max) throw new InvalidInput(`${label(field)} cannot be more than ${max}`);
  return n;
};

const cleanNumber = (value, { field, min, max, required = false, fallback } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new InvalidInput(`${label(field)} is required`);
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new InvalidInput(`${label(field)} must be a number`);
  if (min !== undefined && n < min) throw new InvalidInput(`${label(field)} must be at least ${min}`);
  if (max !== undefined && n > max) throw new InvalidInput(`${label(field)} cannot be more than ${max}`);
  return n;
};

const cleanBool = (value, { fallback = false } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return fallback;
};

/**
 * One of a fixed set.
 *
 * With a `fallback`, an unrecognised value quietly becomes the default -- right
 * for cosmetic fields. Without one it raises, which is what anything the
 * business logic branches on should do.
 */
const cleanEnum = (value, allowed, { field, fallback, required = false } = {}) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) {
    if (required && fallback === undefined) throw new InvalidInput(`${label(field)} is required`);
    return fallback;
  }
  const match = allowed.find((a) => String(a).toLowerCase() === raw);
  if (match !== undefined) return match;
  if (fallback !== undefined) return fallback;
  throw new InvalidInput(`${label(field)} must be one of: ${allowed.join(', ')}`);
};

const cleanObjectId = (value, { field = 'id', required = false } = {}) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) throw new InvalidInput(`${field} is required`);
    return undefined;
  }
  if (!/^[0-9a-fA-F]{24}$/.test(raw)) throw new InvalidInput(`That ${field} is not valid`);
  return raw;
};

/**
 * A URL safe to store and later render in an href or src.
 *
 * Only http, https and site-relative paths are allowed. `javascript:` and
 * `data:` are the two schemes that turn a stored string into script execution
 * the moment something renders it as a link.
 */
const cleanUrl = (value, { field = 'Link', required = false } = {}) => {
  const raw = stripTags(value).trim();
  if (!raw) {
    if (required) throw new InvalidInput(`${field} is required`);
    return '';
  }
  if (raw.startsWith('/')) return raw.slice(0, 2048);
  if (!/^https?:\/\//i.test(raw)) throw new InvalidInput(`${field} must start with http:// or https://`);
  return raw.slice(0, 2048);
};

/**
 * Copy only the named keys.
 *
 * The counterpart to `{ ...req.body }`: a client cannot smuggle in a field the
 * caller never intended to accept -- `role: 'admin'`, `isApproved: true`, a
 * price -- simply by adding it to the payload.
 */
const pick = (source, keys) => {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  }
  return out;
};

module.exports = {
  InvalidInput,
  stripTags,
  stripUnprintable,
  cleanText,
  cleanMultiline,
  cleanEmail,
  cleanPhone,
  cleanPincode,
  cleanInt,
  cleanNumber,
  cleanBool,
  cleanEnum,
  cleanObjectId,
  cleanUrl,
  pick,
};
