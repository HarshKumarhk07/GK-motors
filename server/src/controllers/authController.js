const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendOTPEmail, sendWelcomeEmail } = require('../services/emailService');
const {
  cleanText, cleanEmail, cleanPhone, cleanPincode, cleanNumber,
} = require('../utils/sanitize');
const crypto = require('crypto');
const { clearRateLimit } = require('../middleware/rateLimit');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** Both endpoints answer with this, whatever actually went wrong. */
const OTP_INVALID = 'That code is not valid or has expired. Please request a new one.';
/** Same reply for a known and an unknown address, so neither can be probed. */
const OTP_SENT = 'If an account exists for that email, a verification code has been sent.';

/**
 * Math.random() is not a CSPRNG — its output is predictable from earlier draws,
 * and a predictable login code is not a login code.
 */
const generateOTP = () => String(crypto.randomInt(100000, 1000000));

/**
 * Codes are stored as an HMAC, never in the clear, so a database dump is not a
 * pile of live login codes. Keyed rather than a bare hash because the whole
 * 6-digit space precomputes in well under a second.
 */
const hashOTP = (otp) =>
  crypto
    .createHmac('sha256', process.env.OTP_SECRET || process.env.JWT_SECRET || 'gk-motors-otp')
    .update(String(otp))
    .digest('hex');

/** Constant-time compare, so response timing cannot leak a partial match. */
const hashesMatch = (a, b) => {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * The schema lowercases and trims on save, but not on query — so a lookup for
 * ' User@Example.com ' misses the document it created. Every read of an email
 * goes through here.
 */
const normaliseEmail = (value) => String(value || '').trim().toLowerCase();

// @desc  Register user
// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  /* Every field is validated before anything touches the database.
     Previously `name`, `email` and `phone` went straight into User.create()
     unchecked: the schema has no format validator on either identifier, so an
     address like "notanemail" was stored happily and then became an account
     that could never receive an OTP. Only `password` was enforced, by the
     schema's minlength. */
  const name = cleanText(req.body.name, { field: 'Name', min: 2, max: 80, required: true });
  const email = cleanEmail(req.body.email);
  const phone = cleanPhone(req.body.phone);
  const { password } = req.body;

  if (!email && !phone) {
    res.status(400);
    throw new Error('An email address or a phone number is required');
  }

  /* Length is capped here as well as by the schema. bcrypt silently ignores
     anything past 72 bytes, so a longer value is not the password the user
     thinks it is, and an unbounded one is free CPU for an attacker. */
  if (password !== undefined && password !== null && String(password).length > 72) {
    res.status(400);
    throw new Error('Password cannot exceed 72 characters');
  }

  // Build the duplicate check from the identifiers actually supplied. Mongoose
  // strips undefined values from a query, so { $or: [{ email: undefined }, ...] }
  // collapses to { $or: [{}, ...] } — and an empty clause matches every
  // document, which made phone-only signup fail as "already exists" the moment
  // the collection had one user in it.
  const identifiers = [];
  if (email) identifiers.push({ email });
  if (phone) identifiers.push({ phone });

  const existingUser = await User.findOne({ $or: identifiers });
  if (existingUser) {
    res.status(400);
    throw new Error('User already exists with this email or phone');
  }

  const user = await User.create({ name, email, phone, password });
  const token = generateToken(user._id);

  // Welcome mail. Fired and forgotten: a mail outage must never cost someone
  // their signup, and the account already exists by this point.
  if (user.email) {
    sendWelcomeEmail(user)
      .catch((err) => console.error('[authController.welcomeEmail]', err.message));
  }

  res.status(201).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      addresses: user.addresses || [],
    },
  });
});

// @desc  Login user
// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  const user = await User.findOne(email ? { email: normaliseEmail(email) } : { phone: String(phone || '').trim() });
  if (!user || !user.password) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('Account is deactivated');
  }

  // Admin secret key check (forces nodemon reload)
  if (user.role === 'admin') {
    const adminSecret = process.env.ADMIN_SECRET_KEY || 'adminsecret';
    const { secretKey } = req.body;
    if (!secretKey) {
      return res.json({
        success: true,
        requiresSecretKey: true,
        message: 'Admin verification required',
      });
    }
    if (secretKey !== adminSecret) {
      res.status(401);
      throw new Error('Invalid secret key');
    }
  }

  const token = generateToken(user._id);
  res.json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      addresses: user.addresses || [],
    },
  });
});

// @desc  Email a one-time login code
// @route POST /api/auth/send-otp
/**
 * Email only. There is no SMS provider wired up, and an OTP path that cannot
 * deliver is worse than no path at all — see the login screen, which no longer
 * offers a phone field.
 */
const sendOTP = asyncHandler(async (req, res) => {
  const email = normaliseEmail(req.body.email);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400);
    throw new Error('Enter a valid email address.');
  }

  const user = await User.findOne({ email }).select('+otp +otpExpiry +otpAttempts');

  // An unknown address is answered exactly like a known one. This endpoint used
  // to create an account for whatever was submitted, which let anyone fill the
  // users collection unauthenticated and probe which addresses are registered.
  if (!user || !user.isActive) {
    return res.json({ success: true, message: OTP_SENT });
  }

  const otp = generateOTP();
  user.otp = hashOTP(otp);
  user.otpExpiry = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  await user.save();

  try {
    await sendOTPEmail(user.email, otp);
  } catch (err) {
    // Clear the code we could not deliver rather than leaving a live one behind
    // that nobody has seen. The code itself is never logged: server logs are
    // not a delivery channel.
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
    console.error('[authController.sendOTP]', err.message);
    res.status(502);
    throw new Error('We could not send the code just now. Please try again in a minute.');
  }

  res.json({ success: true, message: OTP_SENT });
});

// @desc  Verify an emailed code and log the user in
// @route POST /api/auth/verify-otp
const verifyOTP = asyncHandler(async (req, res) => {
  const email = normaliseEmail(req.body.email);
  const otp = String(req.body.otp ?? '').trim();

  // Shape is checked before anything is loaded. Without this, a request with no
  // `otp` at all reached a `user.otp !== otp` comparison where both sides were
  // undefined — which is false, so the guard passed and the endpoint handed out
  // a token for any email address.
  if (!email || !/^\d{6}$/.test(otp)) {
    res.status(400);
    throw new Error(OTP_INVALID);
  }

  const user = await User.findOne({ email }).select('+otp +otpExpiry +otpAttempts');

  // Identical answer whether or not the account exists, so verification cannot
  // be used to enumerate addresses either.
  if (!user || !user.isActive || !user.otp || !user.otpExpiry) {
    res.status(400);
    throw new Error(OTP_INVALID);
  }

  const clearCode = async () => {
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    await user.save();
  };

  if (user.otpExpiry.getTime() < Date.now()) {
    await clearCode();
    res.status(400);
    throw new Error(OTP_INVALID);
  }

  if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    await clearCode();
    res.status(400);
    throw new Error('Too many incorrect attempts. Please request a new code.');
  }

  if (!hashesMatch(hashOTP(otp), user.otp)) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await user.save();
    res.status(400);
    throw new Error(OTP_INVALID);
  }

  await clearCode();

  // A code is single use, so a successful login should not leave the address
  // part-way through its verify budget.
  clearRateLimit('otp-verify', req, email);
  clearRateLimit('otp', req, email);

  if (!user.name || user.name === 'User') {
    user.name = email.split('@')[0];
    await user.save();
  }

  const token = generateToken(user._id);
  res.json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      addresses: user.addresses || [],
    },
  });
});

// @desc  Get current user profile
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -otp -otpExpiry').populate('wishlist', 'title brand model price images');
  res.json({ success: true, user });
});

// @desc  Update profile
// @route PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
  /* Same rules as registration. This endpoint used to assign req.body values
     straight onto the document, so an account could be edited into a state
     registration would have refused. */
  const name = cleanText(req.body.name, { field: 'Name', min: 2, max: 80 });
  const email = cleanEmail(req.body.email);
  const phone = cleanPhone(req.body.phone);

  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (req.file) user.avatar = req.file.path;

  await user.save();
  res.json({ success: true, user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } });
});

/**
 * Build a stored address from a request body.
 *
 * Only the seven fields the schema defines are read, and each is validated.
 * `addAddress` previously did `user.addresses.push(req.body)` -- the whole
 * body, whatever it contained, straight into the subdocument array. The
 * pincode rule matches the one createServiceBooking enforces, so an address
 * can no longer be saved in a shape that blocks checkout later.
 */
const cleanAddressInput = (body = {}) => {
  const address = {
    label: cleanText(body.label, { field: 'Label', max: 40 }) || 'Address',
    street: cleanText(body.street, { field: 'Street address', min: 3, max: 200, required: true }),
    city: cleanText(body.city, { field: 'City', min: 2, max: 80, required: true }),
    state: cleanText(body.state, { field: 'State', min: 2, max: 80, required: true }),
    pincode: cleanPincode(body.pincode),
  };

  // Coordinates are optional and only kept when both are present and sane;
  // a half-set pair is worse than none.
  const lat = cleanNumber(body.lat, { field: 'Latitude', min: -90, max: 90 });
  const lng = cleanNumber(body.lng, { field: 'Longitude', min: -180, max: 180 });
  if (lat !== undefined && lng !== undefined) {
    address.lat = lat;
    address.lng = lng;
  }
  return address;
};

// A single account does not need an unbounded address book, and an unbounded
// array is a slow document.
const MAX_ADDRESSES = 20;

// @desc  Add address
// @route POST /api/auth/address
const addAddress = asyncHandler(async (req, res) => {
  const address = cleanAddressInput(req.body);

  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  if ((user.addresses?.length || 0) >= MAX_ADDRESSES) {
    res.status(400);
    throw new Error(`You can save up to ${MAX_ADDRESSES} addresses. Please remove one first.`);
  }

  user.addresses.push(address);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

// @desc  Toggle wishlist
// @route POST /api/auth/wishlist/:bikeId
const toggleWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const bikeId = req.params.bikeId;
  const index = user.wishlist.indexOf(bikeId);
  if (index > -1) {
    user.wishlist.splice(index, 1);
  } else {
    user.wishlist.push(bikeId);
  }
  await user.save();
  res.json({ success: true, wishlist: user.wishlist });
});
// @desc  Update address
// @route PUT /api/auth/address/:addressId
const updateAddress = asyncHandler(async (req, res) => {
  /* Validated through the same builder as addAddress, so an address cannot be
     edited into a shape it could never have been created in. The old version
     copied each field behind a truthiness check with no format validation --
     which also meant a field could never be cleared, since '' is falsy. */
  const next = cleanAddressInput(req.body);

  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const address = user.addresses.id(req.params.addressId);
  if (!address) { res.status(404); throw new Error('Address not found'); }

  address.label = next.label;
  address.street = next.street;
  address.city = next.city;
  address.state = next.state;
  address.pincode = next.pincode;
  address.lat = next.lat;
  address.lng = next.lng;

  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

// @desc  Delete address
// @route DELETE /api/auth/address/:addressId
const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const addressIndex = user.addresses.findIndex(a => a._id.toString() === req.params.addressId);
  if (addressIndex === -1) { res.status(404); throw new Error('Address not found'); }
  
  user.addresses.splice(addressIndex, 1);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

module.exports = { register, login, sendOTP, verifyOTP, getMe, updateProfile, addAddress, updateAddress, deleteAddress, toggleWishlist };
