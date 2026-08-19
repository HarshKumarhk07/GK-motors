const asyncHandler = require('express-async-handler');
const ServiceCar = require('../models/ServiceCar');
const ServiceBooking = require('../models/ServiceBooking');

// Local-disk uploads come back as an absolute path; normalise to a URL the
// client can load. Cloudinary paths are already absolute URLs.
const toUrl = (file) =>
  file.path.includes('uploads')
    ? '/uploads' + file.path.split('uploads')[1].replace(/\\/g, '/')
    : file.path;

const parseMaybeJSON = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error('serviceCarController: failed to parse JSON field ->', err.message);
    return fallback;
  }
};

// Drop malformed / zero-id entries so a bad row cannot fail the whole save.
const sanitisePrices = (prices) =>
  (Array.isArray(prices) ? prices : [])
    .filter((p) => p && p.serviceType && p.price !== '' && p.price !== null && p.price !== undefined)
    .map((p) => ({ serviceType: p.serviceType, price: Number(p.price) }))
    .filter((p) => !Number.isNaN(p.price) && p.price >= 0);

// @desc  Get active service cars (customer-facing)
// @route GET /api/service-cars
// @access Public
const getServiceCars = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = { isActive: true };
  if (search) {
    query.$or = [
      { brand: new RegExp(search, 'i') },
      { model: new RegExp(search, 'i') },
    ];
  }
  const cars = await ServiceCar.find(query)
    .populate('servicePrices.serviceType', 'value label categoryId tier basePrice')
    .sort({ brand: 1, model: 1, year: -1 });

  res.json({ success: true, total: cars.length, cars });
});

// @desc  Get a single service car
// @route GET /api/service-cars/:id
// @access Public
const getServiceCar = asyncHandler(async (req, res) => {
  const car = await ServiceCar.findById(req.params.id)
    .populate('servicePrices.serviceType', 'value label categoryId tier basePrice');
  if (!car || !car.isActive) {
    res.status(404);
    throw new Error('Car not found or no longer available');
  }
  res.json({ success: true, car });
});

// @desc  Get every service car including deactivated ones
// @route GET /api/service-cars/admin
// @access Admin
const getAllServiceCars = asyncHandler(async (req, res) => {
  const cars = await ServiceCar.find()
    .populate('servicePrices.serviceType', 'value label categoryId tier basePrice')
    .sort({ createdAt: -1 });
  res.json({ success: true, total: cars.length, cars });
});

// @desc  Create a service car
// @route POST /api/service-cars
// @access Admin
const createServiceCar = asyncHandler(async (req, res) => {
  const { brand, model, year, fuelType, transmission } = req.body;

  if (!brand || !model || !year) {
    res.status(400);
    throw new Error('Brand, model and year are required');
  }

  const servicePrices = sanitisePrices(parseMaybeJSON(req.body.servicePrices, []));

  // A soft-deleted car occupies the unique brand+model+year slot. Reactivate
  // and update it instead of failing with a duplicate-key error.
  const existing = await ServiceCar.findOne({
    brand: brand.trim(),
    model: model.trim(),
    year: Number(year),
  });

  if (existing) {
    if (existing.isActive) {
      res.status(400);
      throw new Error('This brand, model and year already exists');
    }
    existing.isActive = true;
    existing.fuelType = fuelType || existing.fuelType;
    existing.transmission = transmission || existing.transmission;
    if (servicePrices.length) existing.servicePrices = servicePrices;
    if (req.file) existing.image = toUrl(req.file);
    await existing.save();
    return res.status(200).json({ success: true, car: existing, reactivated: true });
  }

  const car = await ServiceCar.create({
    brand: brand.trim(),
    model: model.trim(),
    year: Number(year),
    fuelType: fuelType || 'petrol',
    transmission: transmission || 'manual',
    servicePrices,
    image: req.file ? toUrl(req.file) : null,
  });

  res.status(201).json({ success: true, car });
});

// @desc  Update a service car
// @route PUT /api/service-cars/:id
// @access Admin
const updateServiceCar = asyncHandler(async (req, res) => {
  const car = await ServiceCar.findById(req.params.id);
  if (!car) {
    res.status(404);
    throw new Error('Car not found');
  }

  const { brand, model, year, fuelType, transmission, isActive } = req.body;

  if (brand) car.brand = brand.trim();
  if (model) car.model = model.trim();
  if (year) car.year = Number(year);
  if (fuelType) car.fuelType = fuelType;
  if (transmission) car.transmission = transmission;
  if (isActive !== undefined) car.isActive = isActive === true || isActive === 'true';

  if (req.body.servicePrices !== undefined) {
    car.servicePrices = sanitisePrices(parseMaybeJSON(req.body.servicePrices, []));
  }
  if (req.file) car.image = toUrl(req.file);

  // Guard the unique index before hitting the DB so the client gets a clear message.
  const clash = await ServiceCar.findOne({
    _id: { $ne: car._id },
    brand: car.brand,
    model: car.model,
    year: car.year,
  });
  if (clash) {
    res.status(400);
    throw new Error('Another car with this brand, model and year already exists');
  }

  await car.save();
  const populated = await ServiceCar.findById(car._id)
    .populate('servicePrices.serviceType', 'value label categoryId tier basePrice');
  res.json({ success: true, car: populated });
});

// @desc  Deactivate a service car (soft delete — bookings reference it)
// @route DELETE /api/service-cars/:id
// @access Admin
const deleteServiceCar = asyncHandler(async (req, res) => {
  const car = await ServiceCar.findById(req.params.id);
  if (!car) {
    res.status(404);
    throw new Error('Car not found');
  }

  const bookingCount = await ServiceBooking.countDocuments({
    'selectedCar.carId': String(car._id),
  });

  car.isActive = false;
  await car.save();

  res.json({
    success: true,
    message: bookingCount
      ? `Car deactivated. ${bookingCount} existing booking(s) still reference it.`
      : 'Car deactivated successfully',
    bookingCount,
  });
});

module.exports = {
  getServiceCars,
  getServiceCar,
  getAllServiceCars,
  createServiceCar,
  updateServiceCar,
  deleteServiceCar,
};
