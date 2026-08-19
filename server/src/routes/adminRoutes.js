const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getUsers, updateUser, approveBike, getMechanics, createMechanic,
  createCategory, getCategories, deleteCategory,
  createBrand, getBrandsList, deleteBrand,
  getAllEnquiries, updateEnquiry,
  getServiceTypes, getActiveServiceTypes, createServiceType, updateServiceType,
  bulkUpdateServiceTypePrices, setCategoryImage, deleteServiceType
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { uploadCategoryMedia } = require('../middleware/upload');

// Public route — no auth needed
router.get('/service-types/active', getActiveServiceTypes);

router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.put('/bikes/:id/approve', approveBike);
router.get('/mechanics', getMechanics);
router.post('/mechanics', createMechanic);

// Categories
router.get('/categories', getCategories);
router.post('/categories', uploadCategoryMedia.single('image'), createCategory);
router.delete('/categories/:id', deleteCategory);

// Enquiries
router.get('/enquiries', getAllEnquiries);
router.put('/enquiries/:id', updateEnquiry);

// Service Types (admin CRUD)
router.get('/service-types', getServiceTypes);
// Bulk price update must be declared before '/service-types/:id'.
router.put('/service-types/bulk-prices', bulkUpdateServiceTypePrices);
// Static segment, so it must also sit above '/service-types/:id'.
router.put('/service-types/category-image/:categoryId', uploadCategoryMedia.single('image'), setCategoryImage);
router.post('/service-types', uploadCategoryMedia.single('image'), createServiceType);
router.put('/service-types/:id', uploadCategoryMedia.single('image'), updateServiceType);
router.delete('/service-types/:id', deleteServiceType);

// Brands
router.get('/brands-list', getBrandsList);
router.post('/brands', uploadCategoryMedia.single('image'), createBrand);
router.delete('/brands/:id', deleteBrand);

module.exports = router;

