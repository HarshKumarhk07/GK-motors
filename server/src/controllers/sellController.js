const asyncHandler = require('express-async-handler');
const SellRequest = require('../models/SellRequest');
const { estimateCarPrice } = require('../utils/priceEstimator');

// @desc  Create sell request
// @route POST /api/sell
const createSellRequest = asyncHandler(async (req, res) => {
  const { brand, model, year, kmDriven, fuelType, transmission, variant, ownerNumber } = req.body;
  const estimatedPrice = estimateCarPrice({ brand, model, year, kmDriven, fuelType, transmission, variant, ownerNumber });

  const images = req.files ? req.files.map((f) => f.path) : [];

  const body = { ...req.body };
  if (typeof body.pickupAddress === 'string') body.pickupAddress = JSON.parse(body.pickupAddress);
  if (typeof body.features === 'string') body.features = JSON.parse(body.features);

  const sellRequest = await SellRequest.create({
    ...body,
    user: req.user._id,
    images,
    estimatedPrice,
    statusHistory: [{ status: 'pending', note: 'Request submitted' }],
  });

  res.status(201).json({ success: true, sellRequest, estimatedPrice });
});

// ... (existing code handles other routes)

// @desc  Get price estimate
// @route POST /api/sell/estimate
const getPriceEstimate = asyncHandler(async (req, res) => {
  const { brand, model, year, kmDriven, fuelType, transmission, variant, ownerNumber } = req.body;
  const estimatedPrice = estimateCarPrice({ brand, model, year, kmDriven, fuelType, transmission, variant, ownerNumber });
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
