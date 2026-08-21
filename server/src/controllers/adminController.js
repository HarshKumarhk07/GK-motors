const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Bike = require('../models/Bike');
const Enquiry = require('../models/Enquiry');
const ServiceBooking = require('../models/ServiceBooking');
const SellRequest = require('../models/SellRequest');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const ServiceType = require('../models/ServiceType');
const RentalCar = require('../models/RentalCar');
const RentalBooking = require('../models/RentalBooking');

// @desc  Dashboard stats
// @route GET /api/admin/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const [users, bikes, services, sells, orders, rentalCars, rentalBookings] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Bike.countDocuments(),
    ServiceBooking.countDocuments(),
    SellRequest.countDocuments(),
    Order.countDocuments(),
    RentalCar.countDocuments(),
    RentalBooking.countDocuments(),
  ]);

  const pendingServices = await ServiceBooking.countDocuments({ status: 'requested' });
  const pendingSells = await SellRequest.countDocuments({ status: 'pending' });
  const pendingRentals = await RentalBooking.countDocuments({ status: 'requested' });
  const revenue = await Order.aggregate([
    { $match: { 'payment.status': 'paid' } },
    { $group: { _id: null, total: { $sum: '$total' } } },
  ]);

  res.json({
    success: true,
    stats: {
      users, bikes, services, sells, orders, rentalCars, rentalBookings,
      pendingServices, pendingSells, pendingRentals,
      revenue: revenue[0]?.total || 0,
    },
  });
});

// @desc  Get all users
// @route GET /api/admin/users
const getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const query = role ? { role } : {};
  const total = await User.countDocuments(query);
  const users = await User.find(query).select('-password -otp -otpExpiry').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
  res.json({ success: true, total, users });
});

// Only these may be set from the admin panel. Passing req.body straight to
// findByIdAndUpdate let a caller write ANY field — including `password`, which
// would bypass the bcrypt pre('save') hook in models/User.js and land in the
// database as plaintext.
const USER_EDITABLE = ['name', 'phone', 'role', 'isActive'];
const ROLES = ['user', 'admin', 'mechanic'];

// @desc  Update user (role, status)
// @route PUT /api/admin/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const updates = {};
  for (const field of USER_EDITABLE) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.role !== undefined && !ROLES.includes(updates.role)) {
    res.status(400);
    throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  }

  const isSelf = String(user._id) === String(req.user._id);
  const losingAdmin =
    user.role === 'admin' &&
    ((updates.role !== undefined && updates.role !== 'admin') || updates.isActive === false);

  // Demoting or disabling yourself locks you out of the panel you are standing
  // in, and the only way back is a terminal. Refuse it.
  if (isSelf && losingAdmin) {
    res.status(400);
    throw new Error(
      'You cannot change your own role or disable your own account. '
      + 'Ask another admin, or use the seed:admin command on the server.'
    );
  }

  // Same for the last admin standing — otherwise nobody can administer anything.
  if (losingAdmin) {
    const admins = await User.countDocuments({ role: 'admin', isActive: true });
    if (admins <= 1) {
      res.status(400);
      throw new Error('This is the only active admin. Promote someone else first.');
    }
  }

  Object.assign(user, updates);
  await user.save();

  const safe = user.toObject();
  delete safe.password;
  res.json({ success: true, user: safe });
});

// @desc  Approve bike listing
// @route PUT /api/admin/bikes/:id/approve
const approveBike = asyncHandler(async (req, res) => {
  const bike = await Bike.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
  if (!bike) { res.status(404); throw new Error('Bike not found'); }
  res.json({ success: true, bike });
});

// @desc  Get mechanics
// @route GET /api/admin/mechanics
const getMechanics = asyncHandler(async (req, res) => {
  const mechanics = await User.find({ role: 'mechanic', isActive: true }).select('name phone email');
  res.json({ success: true, mechanics });
});

// @desc  Create a mechanic user (admin)
// @route POST /api/admin/mechanics
const createMechanic = asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone) {
    res.status(400);
    throw new Error('Name and phone are required');
  }
  const existing = await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
  if (existing) {
    if (existing.role !== 'mechanic') {
      existing.role = 'mechanic';
      existing.isActive = true;
      await existing.save();
      return res.status(200).json({ success: true, mechanic: { _id: existing._id, name: existing.name, phone: existing.phone, email: existing.email } });
    }
    res.status(400);
    throw new Error('A mechanic with this phone or email already exists');
  }
  const mechanic = await User.create({
    name,
    phone,
    email: email || undefined,
    password: password || phone, // default password = phone (must be reset later)
    role: 'mechanic',
    isActive: true,
  });
  res.status(201).json({
    success: true,
    mechanic: { _id: mechanic._id, name: mechanic.name, phone: mechanic.phone, email: mechanic.email },
  });
});

const toUrl = (f) => {
  if (!f) return null;
  const p = f.path || f.url || f.secure_url || '';
  if (!p) return null;
  return p.includes('uploads') ? '/uploads' + p.split('uploads')[1].replace(/\\/g, '/') : p;
};

// @desc  Create Category
const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const image = req.file ? toUrl(req.file) : null;
  const category = await Category.create({ name, image });
  res.status(201).json({ success: true, category });
});


// @desc  Get Categories
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ success: true, categories });
});

// @desc  Delete Category
const deleteCategory = asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Category deleted' });
});

// @desc  Create Brand
const createBrand = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const image = req.file ? toUrl(req.file) : null;
  const brand = await Brand.create({ name, image });
  res.status(201).json({ success: true, brand });
});


// @desc  Get Brands
const getBrandsList = asyncHandler(async (req, res) => {
  const brands = await Brand.find().sort({ name: 1 });
  res.json({ success: true, brands });
});

// @desc  Delete Brand
const deleteBrand = asyncHandler(async (req, res) => {
  await Brand.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Brand deleted' });
});

// @desc  Get all enquiries (admin)
// @route GET /api/admin/enquiries
const getAllEnquiries = asyncHandler(async (req, res) => {
  const enquiries = await Enquiry.find()
    .populate('user', 'name email phone')
    .populate({ path: 'bike', select: 'title brand model year price images location' })
    .sort({ createdAt: -1 });
  res.json({ success: true, enquiries });
});

// @desc  Update enquiry status (admin)
// @route PUT /api/admin/enquiries/:id
const updateEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('user', 'name email phone')
    .populate({ path: 'bike', select: 'title brand model year price images location' });
  if (!enquiry) { res.status(404); throw new Error('Enquiry not found'); }
  res.json({ success: true, enquiry });
});

// ── Service Types CRUD ──
const getServiceTypes = asyncHandler(async (req, res) => {
  const types = await ServiceType.find().sort({ order: 1, createdAt: 1 });
  res.json({ success: true, serviceTypes: types });
});

const getActiveServiceTypes = asyncHandler(async (req, res) => {
  const types = await ServiceType.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, serviceTypes: types });
});

// Numeric/boolean fields arrive as strings when the request is multipart.
const coerceServiceTypeBody = (body, file) => {
  const out = { ...body };
  if (out.basePrice !== undefined && out.basePrice !== '') {
    const n = Number(out.basePrice);
    if (!Number.isNaN(n) && n >= 0) out.basePrice = n; else delete out.basePrice;
  } else {
    delete out.basePrice;
  }
  if (out.categoryId !== undefined && out.categoryId !== '') {
    const n = Number(out.categoryId);
    if (!Number.isNaN(n)) out.categoryId = n; else delete out.categoryId;
  }
  if (out.order !== undefined && out.order !== '') {
    const n = Number(out.order);
    if (!Number.isNaN(n)) out.order = n; else delete out.order;
  }
  if (out.isActive !== undefined) out.isActive = out.isActive === true || out.isActive === 'true';
  if (file) {
    out.image = toUrl(file);
  } else if (out.imageUrl) {
    out.image = out.imageUrl;
    delete out.imageUrl;
  } else if (out.image === '' || out.image === 'null' || out.image === 'undefined') {
    delete out.image;
  }
  return out;
};

const createServiceType = asyncHandler(async (req, res) => {
  const type = await ServiceType.create(coerceServiceTypeBody(req.body, req.file));
  res.status(201).json({ success: true, serviceType: type });
});

const updateServiceType = asyncHandler(async (req, res) => {
  const type = await ServiceType.findByIdAndUpdate(
    req.params.id,
    coerceServiceTypeBody(req.body, req.file),
    { new: true, runValidators: true }
  );
  if (!type) { res.status(404); throw new Error('Service type not found'); }
  res.json({ success: true, serviceType: type });
});

// Update the basePrice of many packages in one request.
// Body: { updates: [{ id, basePrice }] }
const bulkUpdateServiceTypePrices = asyncHandler(async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || !updates.length) {
    res.status(400);
    throw new Error('No price updates supplied');
  }
  const clean = updates
    .map((u) => ({ id: u.id, basePrice: Number(u.basePrice) }))
    .filter((u) => u.id && Number.isFinite(u.basePrice) && u.basePrice >= 0);

  if (!clean.length) {
    res.status(400);
    throw new Error('No valid price updates supplied');
  }

  await Promise.all(clean.map((u) => ServiceType.findByIdAndUpdate(
    u.id,
    { basePrice: u.basePrice, price: `From \u20b9${u.basePrice.toLocaleString('en-IN')}` },
    { new: true }
  )));

  const serviceTypes = await ServiceType.find().sort({ categoryId: 1, order: 1 });
  res.json({ success: true, updated: clean.length, serviceTypes });
});

// Apply one uploaded image to every package in a category, so the category
// grid on the site has a single piece of artwork to show.
// @route PUT /api/admin/service-types/category-image/:categoryId
const setCategoryImage = asyncHandler(async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  if (!Number.isFinite(categoryId)) {
    res.status(400);
    throw new Error('A valid category id is required');
  }

  const count = await ServiceType.countDocuments({ categoryId });
  if (count === 0) {
    res.status(404);
    throw new Error('That category has no service packages yet. Seed them first.');
  }

  // No file means "clear the artwork and fall back to the shipped illustration".
  const image = req.file ? toUrl(req.file) : null;
  await ServiceType.updateMany({ categoryId }, { $set: { image } });

  const serviceTypes = await ServiceType.find().sort({ categoryId: 1, order: 1 });
  res.json({
    success: true,
    categoryId,
    image,
    updated: count,
    message: image
      ? `Image applied to ${count} package(s) in this category`
      : `Image cleared — the category falls back to its built-in illustration`,
    serviceTypes,
  });
});

const deleteServiceType = asyncHandler(async (req, res) => {
  const type = await ServiceType.findById(req.params.id);
  if (!type) { res.status(404); throw new Error('Service type not found'); }

  // A package referenced by past bookings is deactivated rather than removed,
  // so booking history keeps rendering.
  const ServiceBooking = require('../models/ServiceBooking');
  const inUse = await ServiceBooking.countDocuments({ 'services.serviceType': type._id });
  if (inUse > 0) {
    type.isActive = false;
    await type.save();
    return res.json({
      success: true,
      deactivated: true,
      message: `In use by ${inUse} booking(s) — deactivated instead of deleted.`,
    });
  }

  await ServiceType.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Service type deleted' });
});

module.exports = {
  getDashboardStats, getUsers, updateUser, approveBike, getMechanics, createMechanic,
  createCategory, getCategories, deleteCategory,
  createBrand, getBrandsList, deleteBrand,
  getAllEnquiries, updateEnquiry,
  getServiceTypes, getActiveServiceTypes, createServiceType, updateServiceType,
  bulkUpdateServiceTypePrices, setCategoryImage, deleteServiceType
};
