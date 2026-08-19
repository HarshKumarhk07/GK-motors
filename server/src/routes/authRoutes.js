const express = require('express');
const router = express.Router();
const { register, login, sendOTP, verifyOTP, getMe, updateProfile, addAddress, updateAddress, deleteAddress, toggleWishlist } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.get('/me', protect, getMe);
router.put('/profile', protect, uploadAvatar.single('avatar'), updateProfile);
router.post('/address', protect, addAddress);
router.put('/address/:addressId', protect, updateAddress);
router.delete('/address/:addressId', protect, deleteAddress);
router.post('/wishlist/:bikeId', protect, toggleWishlist);

module.exports = router;
