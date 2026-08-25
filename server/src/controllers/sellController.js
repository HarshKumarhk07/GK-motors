const asyncHandler = require('express-async-handler');
const SellRequest = require('../models/SellRequest');
const { estimateCarPrice } = require('../utils/priceEstimator');
const { cleanText, cleanMultiline, cleanInt, cleanEnum, cleanPincode, cleanNumber } = require('../utils/sanitize');

const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'];
const TRANSMISSIONS = ['manual', 'automatic'];

/** Parse a JSON field sent through multipart, without letting bad JSON 500. */
const parseMaybeJSON = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

/** The vehicle fields both the estimate and the request are built from. */
const cleanVehicleInput = (body = {}) => ({
  brand: cleanText(body.brand, { field: 'Brand', min: 2, max: 50, required: true }),
  model: cleanText(body.model, { field: 'Model', min: 1, max: 50, required: true }),
  year: cleanInt(body.year, {
    field: 'Year', min: 1990, max: new Date().getFullYear() + 1, required: true,
  }),
  kmDriven: cleanInt(body.kmDriven, { field: 'Kilometres driven', min: 0, max: 2000000, fallback: 0 }),
  fuelType: cleanEnum(body.fuelType, FUEL_TYPES, { field: 'Fuel type', fallback: 'petrol' }),
  transmission: cleanEnum(body.transmission, TRANSMISSIONS, { field: 'Transmission', fallback: 'manual' }),
  variant: cleanText(body.variant, { field: 'Variant', max: 80 }),
  ownerNumber: cleanInt(body.ownerNumber, { field: 'Number of owners', min: 1, max: 10, fallback: 1 }),
});

// @desc  Create sell request
// @route POST /api/sell
const createSellRequest = asyncHandler(async (req, res) => {
  /* Was `{ ...req.body }` spread into SellRequest.create(), so the request
     could set its own `estimatedPrice`, `status`, or anything else the schema
     accepts. Only the fields this form collects are read now, and the price
     is computed server-side from the validated vehicle rather than trusted.

     JSON.parse on the two multipart fields is also guarded: an unparseable
     string used to throw a SyntaxError out of the handler as a 500. */
  const vehicle = cleanVehicleInput(req.body);
  const estimatedPrice = estimateCarPrice(vehicle);

  const images = req.files ? req.files.map((f) => f.path) : [];

  const rawAddress = parseMaybeJSON(req.body.pickupAddress, {}) || {};
  const rawFeatures = parseMaybeJSON(req.body.features, []);

  const sellRequest = await SellRequest.create({
    ...vehicle,
    user: req.user._id,
    images,
    estimatedPrice,
    expectedPrice: cleanNumber(req.body.expectedPrice, {
      field: 'Expected price', min: 0, max: 100000000,
    }),
    description: cleanMultiline(req.body.description, { field: 'Description', max: 2000 }),
    pickupAddress: {
      street: cleanText(rawAddress.street, { field: 'Street address', max: 200 }),
      city: cleanText(rawAddress.city, { field: 'City', max: 80 }),
      state: cleanText(rawAddress.state, { field: 'State', max: 80 }),
      pincode: cleanPincode(rawAddress.pincode, { required: false }),
    },
    // Capped in both directions: a hostile client could otherwise post a
    // hundred thousand feature strings into one document.
    features: (Array.isArray(rawFeatures) ? rawFeatures : [])
      .slice(0, 40)
      .map((f) => cleanText(f, { field: 'Feature', max: 60 }))
      .filter(Boolean),
    statusHistory: [{ status: 'pending', note: 'Request submitted' }],
  });

  res.status(201).json({ success: true, sellRequest, estimatedPrice });
});

// ... (existing code handles other routes)

// @desc  Get price estimate
// @route POST /api/sell/estimate
const getPriceEstimate = asyncHandler(async (req, res) => {
  const estimatedPrice = estimateCarPrice(cleanVehicleInput(req.body));
  res.json({ success: true, estimatedPrice });
});

// @desc  Get user's sell requests
// @route GET /api/sell/my
const getMySellRequests = asyncHandler(async (req, res) => {
  const requests = await SellRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, requests });
});

// @desc  Get single sell request
// @route GET /api/sell/:id
const getSellRequest = asyncHandler(async (req, res) => {
  const sellRequest = await SellRequest.findById(req.params.id).populate('user', 'name phone email');
  if (!sellRequest) { res.status(404); throw new Error('Sell request not found'); }
  res.json({ success: true, sellRequest });
});

// @desc  All sell requests (admin)
// @route GET /api/sell
const getAllSellRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = status ? { status } : {};
  const total = await SellRequest.countDocuments(query);
  const requests = await SellRequest.find(query)
    .populate('user', 'name phone')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, requests });
});

// @desc  Update sell request status (admin)
// @route PUT /api/sell/:id/status
const updateSellStatus = asyncHandler(async (req, res) => {
  const { status, adminNote, offeredPrice } = req.body;
  const sellRequest = await SellRequest.findById(req.params.id);
  if (!sellRequest) { res.status(404); throw new Error('Sell request not found'); }

  sellRequest.status = status;
  sellRequest.statusHistory.push({ status, note: adminNote });
  if (adminNote) sellRequest.adminNote = adminNote;
  if (offeredPrice) sellRequest.offeredPrice = offeredPrice;

  await sellRequest.save();
  res.json({ success: true, sellRequest });
});

module.exports = { createSellRequest, getMySellRequests, getSellRequest, getAllSellRequests, updateSellStatus, getPriceEstimate };
