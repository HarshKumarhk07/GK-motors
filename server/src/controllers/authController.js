const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendOTPEmail } = require('../services/emailService');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @desc  Register user
// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || (!email && !phone)) {
    res.status(400);
    throw new Error('Name and email or phone are required');
  }

  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    res.status(400);
    throw new Error('User already exists with this email or phone');
  }

  const user = await User.create({ name, email, phone, password });
  const token = generateToken(user._id);

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

  const user = await User.findOne(email ? { email } : { phone });
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

// @desc  Send OTP to email/phone
// @route POST /api/auth/send-otp
const sendOTP = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;
  if (!email && !phone) {
    res.status(400);
    throw new Error('Email or phone required');
  }

  const user = await User.findOne(email ? { email: String(email).toLowerCase().trim() } : { phone });

  // An unknown address is answered exactly like a known one. Previously this
  // endpoint created an account for whatever was submitted, which let anyone
  // fill the users collection unauthenticated; it also let a caller probe
  // which addresses are registered by watching the response differ.
  if (!user || !user.isActive) {
    return res.json({
      success: true,
      message: 'If that account exists, a verification code has been sent.',
    });
  }

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await user.save();

  if (email) {
    await sendOTPEmail(user.email, otp);
  } else {
    // No SMS provider is wired up yet, so a phone-only OTP cannot be delivered.
    // Say so rather than returning success for a code the user will never get.
    // The code is never logged: server logs are not a delivery channel.
    console.warn(`OTP requested for phone ${phone} but no SMS provider is configured.`);
    res.status(503);
    throw new Error('SMS login is not available yet. Please use your email address.');
  }

  res.json({
    success: true,
    message: 'If that account exists, a verification code has been sent.',
  });
});

// @desc  Verify OTP and login
// @route POST /api/auth/verify-otp
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, phone, otp } = req.body;

  const user = await User.findOne(email ? { email } : { phone });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.otp !== otp || user.otpExpiry < new Date()) {
    res.status(400);
    throw new Error('Invalid or expired OTP');
  }

  user.otp = undefined;
  user.otpExpiry = undefined;
  if (!user.name || user.name === 'User') user.name = email ? email.split('@')[0] : `User${Date.now()}`;
  await user.save();

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
  const { name, email, phone } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (req.file) user.avatar = req.file.path;

  await user.save();
  res.json({ success: true, user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } });
});

// @desc  Add address
// @route POST /api/auth/address
const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses.push(req.body);
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
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) { res.status(404); throw new Error('Address not found'); }
  
  if (req.body.label) address.label = req.body.label;
  if (req.body.street) address.street = req.body.street;
  if (req.body.city) address.city = req.body.city;
  if (req.body.state) address.state = req.body.state;
  if (req.body.pincode) address.pincode = req.body.pincode;
  if (req.body.lat) address.lat = req.body.lat;
  if (req.body.lng) address.lng = req.body.lng;
  
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
