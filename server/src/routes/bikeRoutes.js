const express = require('express');
const router = express.Router();
const { getBikes, getBike, getBrands, createBike, updateBike, deleteBike, getFeaturedBikes, getBestsellerBikes, enquireBike, getMyEnquiries } = require('../controllers/bikeController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { uploadBikeMedia } = require('../middleware/upload');

router.get('/featured', getFeaturedBikes);
router.get('/bestseller', getBestsellerBikes);
router.get('/brands', getBrands);
router.get('/my-enquiries', protect, getMyEnquiries);
router.get('/', getBikes);
router.get('/:id', getBike);
router.post('/', protect, uploadBikeMedia.array('images', 10), createBike);
router.put('/:id', protect, adminOnly, uploadBikeMedia.array('images', 10), updateBike);
router.delete('/:id', protect, adminOnly, deleteBike);
router.post('/:id/enquire', protect, enquireBike);

module.exports = router;
