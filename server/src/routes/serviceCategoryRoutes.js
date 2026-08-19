const express = require('express');
const router = express.Router();
const {
  getServiceCategories,
  getAllServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  createPackage,
  deletePackage,
} = require('../controllers/serviceCategoryController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { uploadCategoryMedia } = require('../middleware/upload');

// Static segments before the `:id` param route.
router.get('/admin', protect, adminOnly, getAllServiceCategories);
router.delete('/packages/:packageId', protect, adminOnly, deletePackage);

router.get('/', getServiceCategories);
router.post('/', protect, adminOnly, uploadCategoryMedia.single('image'), createServiceCategory);
router.put('/:id', protect, adminOnly, uploadCategoryMedia.single('image'), updateServiceCategory);
router.delete('/:id', protect, adminOnly, deleteServiceCategory);
router.post('/:id/packages', protect, adminOnly, uploadCategoryMedia.single('image'), createPackage);

module.exports = router;
