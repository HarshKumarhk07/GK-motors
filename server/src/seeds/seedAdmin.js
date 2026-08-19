require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const crypto = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/User');

/**
 * Create (or promote) the GK Motors admin account.
 *
 *   node server/src/seeds/seedAdmin.js
 *       → creates admin@gkmotors.local with a generated password, printed once.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='YourPass123!' node server/src/seeds/seedAdmin.js
 *       → uses the credentials you supply.
 *
 *   node server/src/seeds/seedAdmin.js --reset
 *       → regenerates the password for an existing admin.
 *
 * The password is never written to disk or committed. If you lose it, re-run
 * with --reset.
 */

const DEFAULT_EMAIL = 'admin@gkmotors.local';

// Ambiguous characters (0/O, 1/l/I) are excluded so the printed password can be
// retyped from a terminal without guesswork.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
const generatePassword = (length = 18) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

const banner = (lines) => {
  const width = Math.max(...lines.map((l) => l.length)) + 4;
  console.log('\n' + '='.repeat(width));
  lines.forEach((l) => console.log('  ' + l));
  console.log('='.repeat(width) + '\n');
};

const seed = async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase().trim();
  const supplied = process.env.ADMIN_PASSWORD;
  const reset = process.argv.includes('--reset');
  const name = process.env.ADMIN_NAME || 'GK Motors Admin';
  const phone = process.env.ADMIN_PHONE || undefined;

  if (supplied && supplied.length < 6) {
    console.error('❌ ADMIN_PASSWORD must be at least 6 characters.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });

  // ── promote / reset an existing account ──
  if (existing) {
    const wasAdmin = existing.role === 'admin';
    existing.role = 'admin';
    existing.isActive = true;

    let password = null;
    if (supplied) {
      password = supplied;
    } else if (reset || !existing.password) {
      password = generatePassword();
    }
    // Assigning triggers the pre('save') bcrypt hook in models/User.js
    if (password) existing.password = password;

    await existing.save();

    if (password) {
      banner([
        wasAdmin ? 'ADMIN PASSWORD RESET' : 'EXISTING USER PROMOTED TO ADMIN',
        '',
        `Portal:    <your site>/admin`,
        `Email:     ${existing.email}`,
        `Password:  ${password}`,
        '',
        'Shown once. Store it in a password manager now.',
      ]);
    } else {
      banner([
        wasAdmin ? 'ALREADY AN ADMIN — no changes made' : 'USER PROMOTED TO ADMIN',
        '',
        `Email: ${existing.email}`,
        'Existing password kept. Re-run with --reset to generate a new one.',
      ]);
    }
    process.exit(0);
  }

  // ── create a fresh admin ──
  const password = supplied || generatePassword();
  const admin = await User.create({
    name,
    email,
    phone,
    password,
    role: 'admin',
    isActive: true,
  });

  banner([
    'GK MOTORS ADMIN CREATED',
    '',
    `Portal:    <your site>/admin`,
    `Email:     ${admin.email}`,
    `Password:  ${password}`,
    '',
    supplied
      ? 'Using the password you supplied.'
      : 'Generated password — shown once. Store it in a password manager now.',
    'Change it from the profile page after your first login.',
  ]);

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Admin seed failed:', err.message);
  process.exit(1);
});
