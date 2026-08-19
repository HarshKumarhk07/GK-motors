const express = require('express');
const router = express.Router();
const {
  getServiceCars,
  getServiceCar,
  getAllServiceCars,
  createServiceCar,
  updateServiceCar,
  deleteServiceCar,
} = require('../controllers/serviceCarController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { uploadServiceCarImage } = require('../middleware/upload');

// Static segments must be registered before the `:id` param route.
router.get('/admin', protect, adminOnly, getAllServiceCars);

router.get('/', getServiceCars);
router.get('/:id', getServiceCar);

router.post('/', protect, adminOnly, uploadServiceCarImage.single('image'), createServiceCar);
router.put('/:id', protect, adminOnly, uploadServiceCarImage.single('image'), updateServiceCar);
router.delete('/:id', protect, adminOnly, deleteServiceCar);

module.exports = router;
