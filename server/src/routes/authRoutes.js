const express = require('express');
const router = express.Router();
const { register, login, sendOTP, verifyOTP, getMe, updateProfile, addAddress, updateAddress, deleteAddress, toggleWishlist } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const {
  loginLimiter, otpLimiter, otpVerifyLimiter, registerLimiter,
} = require('../middleware/rateLimit');

// Unauthenticated endpoints are rate limited by IP and by the account being
// targeted, so one attacker cannot lock out a whole network and password
// guessing is bounded.
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', otpVerifyLimiter, verifyOTP);

router.get('/me', protect, getMe);
router.put('/profile', protect, uploadAvatar.single('avatar'), updateProfile);
router.post('/address', protect, addAddress);
router.put('/address/:addressId', protect, updateAddress);
router.delete('/address/:addressId', protect, deleteAddress);
router.post('/wishlist/:bikeId', protect, toggleWishlist);

module.exports = router;
