const asyncHandler = require('express-async-handler');
const SparePart = require('../models/SparePart');
const Order = require('../models/Order');
const { createOrder: createRazorpayOrder, verifyPayment } = require('../services/paymentService');

// Helper: pincode filter that also includes products with no pincodePricing (available everywhere)
const pincodeFilter = (pincode) => ({
  $or: [
    { 'pincodePricing.pincode': pincode },
    { pincodePricing: { $size: 0 } },
    { pincodePricing: { $exists: false } },
  ]
});

// ---- PARTS ----
// @desc  Get all parts
// @route GET /api/store/parts
const getParts = asyncHandler(async (req, res) => {
  const { category, search, minPrice, maxPrice, page = 1, limit = 12, pincode } = req.query;
  const query = { isActive: true };
  if (category) query.category = category;
  if (search) query.name = new RegExp(search, 'i');
  if (minPrice || maxPrice) query.price = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };
  if (pincode) Object.assign(query, pincodeFilter(pincode));

  const total = await SparePart.countDocuments(query);
  const parts = await SparePart.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
  res.json({ success: true, total, parts });
});

// @desc  Get featured parts
// @route GET /api/store/parts/featured
const getFeaturedParts = asyncHandler(async (req, res) => {
  const { pincode } = req.query;
  const query = { isFeatured: true, isActive: true };
  if (pincode) Object.assign(query, pincodeFilter(pincode));
  const parts = await SparePart.find(query).sort({ createdAt: -1 });
  res.json({ success: true, parts });
});

// @desc  Get bestseller parts
// @route GET /api/store/parts/bestseller
const getBestsellerParts = asyncHandler(async (req, res) => {
  const { pincode } = req.query;
  const query = { bestSeller: true, isActive: true };
  if (pincode) Object.assign(query, pincodeFilter(pincode));
  const parts = await SparePart.find(query).sort({ createdAt: -1 });
  res.json({ success: true, parts });
});

// @desc  Get upcoming/coming-soon parts
// @route GET /api/store/parts/upcoming
const getUpcomingParts = asyncHandler(async (req, res) => {
  const { pincode } = req.query;
  const query = { comingSoon: true, isActive: true };
  if (pincode) Object.assign(query, pincodeFilter(pincode));
  const parts = await SparePart.find(query).sort({ createdAt: -1 });
  res.json({ success: true, parts });
});

// @desc  Get recent parts
// @route GET /api/store/parts/recent
const getRecentParts = asyncHandler(async (req, res) => {
  const { pincode, limit = 20 } = req.query;
  const query = { comingSoon: { $ne: true }, isActive: true };
  if (pincode) Object.assign(query, pincodeFilter(pincode));
  const parts = await SparePart.find(query).sort({ createdAt: -1 }).limit(Number(limit));
  res.json({ success: true, parts });
});

// @desc  Search parts
// @route GET /api/store/parts/search
const searchParts = asyncHandler(async (req, res) => {
  const { keyword, pincode } = req.query;
  if (!keyword) { res.status(400); throw new Error('Search keyword is required'); }
  const regex = new RegExp(keyword, 'i');
  const searchFilter = {
    $or: [{ name: { $regex: regex } }, { brand: { $regex: regex } }, { subCategory: { $regex: regex } }, { category: { $regex: regex } }],
    isActive: true
  };
  const query = pincode ? { $and: [searchFilter, pincodeFilter(pincode)] } : searchFilter;
  const parts = await SparePart.find(query);
  res.json({ success: true, parts });
});

// @desc  Get distinct categories from active parts
// @route GET /api/store/parts/categories
const getPartCategories = asyncHandler(async (req, res) => {
  const categories = await SparePart.distinct('category', { isActive: true, category: { $exists: true, $ne: '' } });
  res.json({ success: true, categories: categories.sort() });
});

// @desc  Get single part
const getPart = asyncHandler(async (req, res) => {
  const part = await SparePart.findById(req.params.id);
  if (!part) { res.status(404); throw new Error('Part not found'); }
  res.json({ success: true, part });
});

const toUrl = (f) => f.path.includes('uploads') ? '/uploads' + f.path.split('uploads')[1].replace(/\\/g, '/') : f.path;

// @desc  Create part (admin)
const createPart = asyncHandler(async (req, res) => {
  const images = (req.files || []).map(toUrl);

  const body = { ...req.body };
  if (typeof body.farmerDetails === 'string') body.farmerDetails = JSON.parse(body.farmerDetails);
  if (typeof body.pincodePricing === 'string') body.pincodePricing = JSON.parse(body.pincodePricing);
  if (typeof body.compatibleBikes === 'string') body.compatibleBikes = JSON.parse(body.compatibleBikes);

  const part = await SparePart.create({ ...body, images });
  res.status(201).json({ success: true, part });
});

// @desc  Update part (admin)
const updatePart = asyncHandler(async (req, res) => {
  const existingPart = await SparePart.findById(req.params.id);
  if (!existingPart) { res.status(404); throw new Error('Part not found'); }

  const body = { ...req.body };

  if (typeof body.farmerDetails === 'string') body.farmerDetails = JSON.parse(body.farmerDetails);
  if (typeof body.pincodePricing === 'string') body.pincodePricing = JSON.parse(body.pincodePricing);
  if (typeof body.compatibleBikes === 'string') body.compatibleBikes = JSON.parse(body.compatibleBikes);

  // Merge with existing valid data if body field is empty or not provided
  for (const key of Object.keys(existingPart.toObject())) {
    if (key === 'price' || key === 'discountedPrice') {
      if (body[key] === '' || body[key] === undefined || body[key] === 'undefined' || body[key] === 'null' || Number(body[key]) === 0) {
        body[key] = existingPart[key];
      }
    } else if (key === 'pincodePricing') {
      if (!body.pincodePricing || !Array.isArray(body.pincodePricing) || body.pincodePricing.length === 0) {
        body.pincodePricing = existingPart.pincodePricing;
      } else if (Array.isArray(existingPart.pincodePricing)) {
        body.pincodePricing = body.pincodePricing.map(newP => {
          const existingP = existingPart.pincodePricing.find(p => p.pincode === newP.pincode && p.size === newP.size);
          if (existingP) {
            return {
              ...existingP.toObject(),
              ...newP,
              price: newP.price || existingP.price,
              originalPrice: newP.originalPrice || existingP.originalPrice,
              discount: newP.discount || existingP.discount,
              inventory: newP.inventory !== undefined && newP.inventory !== null ? newP.inventory : existingP.inventory
            };
          }
          return newP;
        });
      }
    } else {
      if (body[key] === '' || body[key] === undefined || body[key] === 'undefined' || body[key] === 'null') {
        body[key] = existingPart[key];
      }
    }
  }

  // Same for farmerDetails nested object
  if (body.farmerDetails && existingPart.farmerDetails) {
    for (const k of Object.keys(existingPart.farmerDetails.toObject())) {
      if (body.farmerDetails[k] === '' || body.farmerDetails[k] === undefined) {
        body.farmerDetails[k] = existingPart.farmerDetails[k];
      }
    }
  }

  // Merge existing media (URLs kept from client) + newly uploaded files in order
  const existing = body.existingImages ? (Array.isArray(body.existingImages) ? body.existingImages : [body.existingImages]) : [];
  const newUploads = (req.files || []).map(toUrl);
  if (existing.length > 0 || newUploads.length > 0) body.images = [...existing, ...newUploads];
  delete body.existingImages;

  const part = await SparePart.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ success: true, part });
});

// @desc  Delete part (admin)
const deletePart = asyncHandler(async (req, res) => {
  await SparePart.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Part deleted' });
});

// ---- ORDERS ----
// @desc  Place order
const placeOrder = asyncHandler(async (req, res) => {
  const { items, deliveryAddress, payment } = req.body;

  if (!items || !items.length) { res.status(400); throw new Error('No items in order'); }

  let subtotal = 0;
  const orderItems = [];
  for (const item of items) {
    const part = await SparePart.findById(item.product);
    if (!part || part.stock < item.quantity) { res.status(400); throw new Error(`${part?.name || 'Item'} out of stock`); }
    subtotal += (part.discountedPrice || part.price) * item.quantity;
    orderItems.push({ product: item.product, name: part.name, price: part.discountedPrice || part.price, quantity: item.quantity, image: part.images[0] });
    part.stock -= item.quantity;
    await part.save();
  }

  const shippingCharge = subtotal > 500 ? 0 : 50;
  const total = subtotal + shippingCharge;

  const order = await Order.create({
    user: req.user._id, items: orderItems, deliveryAddress,
    subtotal, shippingCharge, total,
    payment: { method: payment?.method || 'cod' },
    statusHistory: [{ status: 'placed', note: 'Order placed' }],
  });

  res.status(201).json({ success: true, order });
});

// @desc  Get user orders
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

// @desc  Get single order
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name phone');
  if (!order) { res.status(404); throw new Error('Order not found'); }
  res.json({ success: true, order });
});

// @desc  Create Razorpay order for parts
const createPartPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  const razorpayOrder = await createRazorpayOrder({ amount: order.total, receipt: `ord_${order._id}` });
  res.json({ success: true, order: razorpayOrder, key: process.env.RAZORPAY_KEY_ID });
});

// @desc  Verify parts payment
const verifyPartPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const isValid = verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!isValid) { res.status(400); throw new Error('Payment verification failed'); }

  const order = await Order.findById(req.params.id);
  order.payment.status = 'paid';
  order.payment.transactionId = razorpay_payment_id;
  order.payment.razorpayOrderId = razorpay_order_id;
  order.payment.paidAt = new Date();
  order.status = 'confirmed';
  order.statusHistory.push({ status: 'confirmed', note: 'Payment confirmed' });
  await order.save();

  res.json({ success: true, order });
});

// @desc  Update order status (admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  order.status = status;
  order.statusHistory.push({ status, note });
  await order.save();
  res.json({ success: true, order });
});

// @desc  Get all orders (admin)
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = status ? { status } : {};
  const total = await Order.countDocuments(query);
  const orders = await Order.find(query).populate('user', 'name phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
  res.json({ success: true, total, orders });
});

module.exports = { getParts, getPart, getPartCategories, getFeaturedParts, getBestsellerParts, getUpcomingParts, getRecentParts, searchParts, createPart, updatePart, deletePart, placeOrder, getMyOrders, getOrder, createPartPayment, verifyPartPayment, updateOrderStatus, getAllOrders };
