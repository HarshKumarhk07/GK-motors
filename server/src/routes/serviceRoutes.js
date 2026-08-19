const express = require('express');
const router = express.Router();
const {
  createBooking,
  createServiceBooking,
  getServiceCategories,
  getAvailability,
  getMyBookings,
  getBooking,
  updateBookingStatus,
  getAllBookings,
  createServicePayment,
  verifyServicePayment,
} = require('../controllers/serviceController');
const { protect } = require('../middleware/auth');
const { adminOnly, mechanicOrAdmin } = require('../middleware/admin');

// ── Static segments first — Express matches in declaration order, so these
//    must sit above `/:id` or they would be swallowed by it. ──
router.get('/categories', getServiceCategories);
router.get('/availability', getAvailability);
router.post('/book', protect, createServiceBooking);
router.get('/my', protect, getMyBookings);

router.post('/', protect, createBooking);          // legacy single-service booking
router.get('/', protect, adminOnly, getAllBookings);

router.get('/:id', protect, getBooking);
router.put('/:id/status', protect, mechanicOrAdmin, updateBookingStatus);
router.post('/:id/payment', protect, createServicePayment);
router.post('/:id/verify-payment', protect, verifyServicePayment);

module.exports = router;
