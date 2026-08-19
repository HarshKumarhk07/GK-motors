const express = require('express');
const router = express.Router();
const { createSellRequest, getMySellRequests, getSellRequest, getAllSellRequests, updateSellStatus, getPriceEstimate } = require('../controllers/sellController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { uploadBikeMedia } = require('../middleware/upload');

router.post('/estimate', getPriceEstimate);
router.post('/', protect, uploadBikeMedia.array('images', 10), createSellRequest);
router.get('/my', protect, getMySellRequests);
router.get('/', protect, adminOnly, getAllSellRequests);
router.get('/:id', protect, getSellRequest);
router.put('/:id/status', protect, adminOnly, updateSellStatus);

module.exports = router;
