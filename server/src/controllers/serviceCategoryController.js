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
/**
 * Package detail fields, parsed out of a multipart body.
 *
 * Everything arrives as a string over FormData, and an empty string means "not
 * set" rather than zero — a package with no warranty must stay unset so the
 * card hides that row instead of printing "0 months".
 */
const optionalNumber = (raw) => {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;   // undefined = invalid
  return n;
};

const parseFeatures = (raw) => {
  if (raw === undefined) return undefined;              // not submitted: leave alone
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); }
    catch { list = raw.split('\n'); }                   // tolerate a plain textarea
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((f) => String(f || '').trim())
    .filter(Boolean)
    .slice(0, 40);
};

const PICKUP_DROP = ['', 'free', 'paid', 'unavailable'];

/**
 * Read the optional detail fields off a request body onto a target object.
 * Returns an error string, or null when everything parsed.
 */
const applyPackageDetail = (target, body) => {
  const numeric = {
    durationHours: 'Duration',
    recommendedIntervalKm: 'Recommended interval (km)',
    recommendedIntervalMonths: 'Recommended interval (months)',
    originalPrice: 'Original price',
  };
  for (const [field, label] of Object.entries(numeric)) {
    if (body[field] === undefined) continue;
    const v = optionalNumber(body[field]);
    if (v === undefined) return `${label} must be a number of 0 or more`;
    target[field] = v;
  }

  if (body.warrantyMonths !== undefined) {
    const v = optionalNumber(body.warrantyMonths);
    if (v === undefined) return 'Warranty months must be a number of 0 or more';
    target.warranty = { ...(target.warranty || {}), months: v };
  }
  if (body.warrantyDistanceKm !== undefined) {
    const v = optionalNumber(body.warrantyDistanceKm);
    if (v === undefined) return 'Warranty distance must be a number of 0 or more';
    target.warranty = { ...(target.warranty || {}), distanceKm: v };
  }

  if (body.pickupDrop !== undefined) {
    const v = String(body.pickupDrop || '');
    if (!PICKUP_DROP.includes(v)) return 'Pickup/drop must be free, paid or unavailable';
    target.pickupDrop = v;
  }

  if (body.isRecommended !== undefined) {
    target.isRecommended = body.isRecommended === true || body.isRecommended === 'true';
  }

  const features = parseFeatures(body.features);
  if (features !== undefined) target.features = features;

  return null;
};

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
  const doc = {
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
  };

  const detailError = applyPackageDetail(doc, req.body);
  if (detailError) { res.status(400); throw new Error(detailError); }

  const pkg = await ServiceType.create(doc);

  res.status(201).json({ success: true, package: pkg });
});

// @desc  Update a package
// @route PUT /api/service-categories/packages/:packageId
// @access Admin
// Only the fields present in the body are touched, so a partial save from the
// admin form cannot blank out something it did not render.
const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await ServiceType.findById(req.params.packageId);
  if (!pkg) { res.status(404); throw new Error('Package not found'); }

  const { label, desc, basePrice, tier, isActive, order } = req.body;

  if (label !== undefined) {
    if (!String(label).trim()) { res.status(400); throw new Error('Package name is required'); }
    pkg.label = String(label).trim();
  }
  if (desc !== undefined) pkg.desc = String(desc).trim();

  if (basePrice !== undefined) {
    const price = Number(basePrice);
    if (!Number.isFinite(price) || price < 0) { res.status(400); throw new Error('Enter a valid base price'); }
    pkg.basePrice = price;
    // Keep the legacy display string in step with the number behind it.
    pkg.price = `From ₹${price.toLocaleString('en-IN')}`;
  }

  if (tier !== undefined && ['basic', 'standard', 'comprehensive', 'single'].includes(tier)) {
    // Same uniqueness rule as create: one graded tier per category, or the
    // cart's swap has nothing deterministic to replace.
    if (tier !== 'single' && tier !== pkg.tier) {
      const clash = await ServiceType.findOne({
        categoryId: pkg.categoryId, tier, _id: { $ne: pkg._id },
      });
      if (clash) {
        res.status(400);
        throw new Error(`"${clash.label}" is already the ${tier} package in this category`);
      }
    }
    pkg.tier = tier;
  }

  if (isActive !== undefined) pkg.isActive = isActive === true || isActive === 'true';
  if (order !== undefined && Number.isFinite(Number(order))) pkg.order = Number(order);
  if (req.file) pkg.image = toUrl(req.file);

  const detailError = applyPackageDetail(pkg, req.body);
  if (detailError) { res.status(400); throw new Error(detailError); }

  await pkg.save();
  res.json({ success: true, package: pkg });
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
  updatePackage,
  deletePackage,
};
