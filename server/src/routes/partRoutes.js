const express = require('express');
const router = express.Router();
const { getParts, getPart, getPartCategories, getFeaturedParts, getBestsellerParts, getUpcomingParts, getRecentParts, searchParts, createPart, updatePart, deletePart, placeOrder, getMyOrders, getOrder, createPartPayment, verifyPartPayment, updateOrderStatus, getAllOrders } = require('../controllers/partController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { uploadPartMedia } = require('../middleware/upload');

// Parts - specific routes before /:id
router.get('/parts/categories', getPartCategories);
router.get('/parts/featured', getFeaturedParts);
router.get('/parts/bestseller', getBestsellerParts);
router.get('/parts/upcoming', getUpcomingParts);
router.get('/parts/recent', getRecentParts);
router.get('/parts/search', searchParts);
router.get('/parts', getParts);
router.get('/parts/:id', getPart);
router.post('/parts', protect, adminOnly, uploadPartMedia, createPart);
router.put('/parts/:id', protect, adminOnly, uploadPartMedia, updatePart);
router.delete('/parts/:id', protect, adminOnly, deletePart);

// Orders
router.post('/orders', protect, placeOrder);
router.get('/orders/my', protect, getMyOrders);
router.get('/orders', protect, adminOnly, getAllOrders);
router.get('/orders/:id', protect, getOrder);
router.post('/orders/:id/payment', protect, createPartPayment);
router.post('/orders/:id/verify-payment', protect, verifyPartPayment);
router.put('/orders/:id/status', protect, adminOnly, updateOrderStatus);

module.exports = router;
