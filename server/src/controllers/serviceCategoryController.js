const asyncHandler = require('express-async-handler');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceType = require('../models/ServiceType');

const toUrl = (file) =>
  file.path.includes('uploads')
    ? '/uploads' + file.path.split('uploads')[1].replace(/\\/g, '/')
    : file.path;

// @desc  Categories for the booking flow, each with its packages
// @route GET /api/service-categories
// @access Public
const getServiceCategories = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.find({ isActive: true }).sort({ order: 1, categoryId: 1 });
  const packages = await ServiceType.find({ isActive: true }).sort({ order: 1 });

  const byCategory = new Map();
  packages.forEach((p) => {
    if (p.categoryId == null) return;
    if (!byCategory.has(p.categoryId)) byCategory.set(p.categoryId, []);
    byCategory.get(p.categoryId).push(p);
  });

  res.json({
    success: true,
    categories: categories.map((c) => ({
      ...c.toObject(),
      packages: byCategory.get(c.categoryId) || [],
      packageCount: (byCategory.get(c.categoryId) || []).length,
    })),
  });
});

// @desc  Every category including disabled ones
// @route GET /api/service-categories/admin
// @access Admin
const getAllServiceCategories = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.find().sort({ order: 1, categoryId: 1 });
  const packages = await ServiceType.find().sort({ order: 1 });

  const byCategory = new Map();
  packages.forEach((p) => {
    if (p.categoryId == null) return;
    if (!byCategory.has(p.categoryId)) byCategory.set(p.categoryId, []);
    byCategory.get(p.categoryId).push(p);
  });

  res.json({
    success: true,
    categories: categories.map((c) => ({
      ...c.toObject(),
      packages: byCategory.get(c.categoryId) || [],
    })),
    // Packages whose category was deleted or never existed — surfaced so they
    // can be reassigned rather than silently disappearing from the site.
    orphanPackages: packages.filter(
      (p) => p.categoryId == null || !categories.some((c) => c.categoryId === p.categoryId)
    ),
  });
});

// @desc  Create a category
// @route POST /api/service-categories
// @access Admin
const createServiceCategory = asyncHandler(async (req, res) => {
  const { name, description, slug, order } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Category name is required');
  }

  const clash = await ServiceCategory.findOne({
    name: new RegExp(`^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (clash) {
    res.status(400);
    throw new Error(`A category named "${clash.name}" already exists`);
  }

  // Allocate the next free id rather than reusing a deleted one, so packages
  // belonging to a removed category can never silently reattach.
  const highest = await ServiceCategory.findOne().sort({ categoryId: -1 }).select('categoryId');
  const highestPackage = await ServiceType.findOne().sort({ categoryId: -1 }).select('categoryId');
  const nextId = Math.max(highest?.categoryId || 0, highestPackage?.categoryId || 0) + 1;

  const count = await ServiceCategory.countDocuments();
  const category = await ServiceCategory.create({
    categoryId: nextId,
    name: String(name).trim(),
    description: description ? String(description).trim() : '',
    slug: slug ? String(slug).trim() : undefined,
    order: order !== undefined ? Number(order) : count + 1,
    image: req.file ? toUrl(req.file) : null,
  });

  res.status(201).json({ success: true, category });
});

// @desc  Update a category
// @route PUT /api/service-categories/:id
// @access Admin
const updateServiceCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.params.id);
  if (!category) { res.status(404); throw new Error('Category not found'); }

  const { name, description, slug, order, isActive } = req.body;
  if (name) category.name = String(name).trim();
  if (description !== undefined) category.description = String(description).trim();
  if (slug !== undefined) category.slug = String(slug).trim();
  if (order !== undefined) category.order = Number(order);
  if (isActive !== undefined) category.isActive = isActive === true || isActive === 'true';
  if (req.file) category.image = toUrl(req.file);

  await category.save();

  // Keep the denormalised name on its packages in step, since bookings and the
  // site read categoryName from there.
  if (name) {
    await ServiceType.updateMany({ categoryId: category.categoryId }, { $set: { categoryName: category.name } });
  }

  res.json({ success: true, category });
});

// @desc  Delete a category
// @route DELETE /api/service-categories/:id
// @access Admin
// Refuses while packages remain unless ?force=true, which deactivates them.
const deleteServiceCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.params.id);
  if (!category) { res.status(404); throw new Error('Category not found'); }

  const packageCount = await ServiceType.countDocuments({ categoryId: category.categoryId });
  const force = req.query.force === 'true';

  if (packageCount > 0 && !force) {
    res.status(400);
    throw new Error(
      `"${category.name}" still has ${packageCount} package(s). Delete them first, or confirm to disable them along with the category.`
    );
  }

  if (packageCount > 0) {
    // Deactivated, not deleted: past bookings reference these documents.
    await ServiceType.updateMany({ categoryId: category.categoryId }, { $set: { isActive: false } });
  }

  await ServiceCategory.findByIdAndDelete(category._id);
  res.json({
    success: true,
    message: packageCount
      ? `Category deleted; ${packageCount} package(s) disabled so existing bookings still resolve.`
      : 'Category deleted',
    disabledPackages: packageCount,
  });
});

// ── Packages (subcategories) ──────────────────────────────────────────────

// @desc  Create a package inside a category
// @route POST /api/service-categories/:id/packages
// @access Admin
const createPackage = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.params.id);
  if (!category) { res.status(404); throw new Error('Category not found'); }

  const { label, desc, basePrice, tier } = req.body;
  if (!label || !String(label).trim()) {
    res.status(400);
    throw new Error('Package name is required');
  }

  const price = Number(basePrice);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400);
    throw new Error('Enter a valid base price');
  }

  const chosenTier = ['basic', 'standard', 'comprehensive', 'single'].includes(tier) ? tier : 'single';

  // Only one of each graded tier may exist per category, otherwise the cart's
  // swap rule has nothing deterministic to replace.
  if (chosenTier !== 'single') {
    const existing = await ServiceType.findOne({ categoryId: category.categoryId, tier: chosenTier });
    if (existing) {
      res.status(400);
      throw new Error(`"${existing.label}" is already the ${chosenTier} package in this category`);
    }
  }

  const base = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  let value = `${category.slug || 'cat'}_${base}`.slice(0, 60);
  if (await ServiceType.findOne({ value })) value = `${value}_${Date.now().toString(36)}`;

  const count = await ServiceType.countDocuments({ categoryId: category.categoryId });
  const pkg = await ServiceType.create({
    value,
    label: String(label).trim(),
    desc: desc ? String(desc).trim() : '',
    price: `From ₹${price.toLocaleString('en-IN')}`,
    basePrice: price,
    categoryId: category.categoryId,
    categoryName: category.name,
    categoryType: 'service',
    tier: chosenTier,
    isActive: true,
    order: count + 1,
    image: req.file ? toUrl(req.file) : null,
  });

  res.status(201).json({ success: true, package: pkg });
});

// @desc  Delete a package
// @route DELETE /api/service-categories/packages/:packageId
// @access Admin
// Deactivates instead when bookings reference it.
const deletePackage = asyncHandler(async (req, res) => {
  const pkg = await ServiceType.findById(req.params.packageId);
  if (!pkg) { res.status(404); throw new Error('Package not found'); }

  const ServiceBooking = require('../models/ServiceBooking');
  const inUse = await ServiceBooking.countDocuments({ 'services.serviceType': pkg._id });

  if (inUse > 0) {
    pkg.isActive = false;
    await pkg.save();
    return res.json({
      success: true,
      deactivated: true,
      message: `"${pkg.label}" is used by ${inUse} booking(s), so it was disabled rather than deleted.`,
    });
  }

  await ServiceType.findByIdAndDelete(pkg._id);
  res.json({ success: true, message: `"${pkg.label}" deleted` });
});

module.exports = {
  getServiceCategories,
  getAllServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  createPackage,
  deletePackage,
};
