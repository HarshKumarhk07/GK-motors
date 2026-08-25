const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const SparePart = require('../models/SparePart');
const Order = require('../models/Order');
const { createOrder: createRazorpayOrder, verifyPayment } = require('../services/paymentService');
const { cleanText, cleanMultiline, cleanNumber, cleanInt, cleanPincode, cleanUrl, cleanBool, pick } = require('../utils/sanitize');

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

// @desc  Every part, for the admin panel
// @route GET /api/store/parts/admin
// @access Admin
/**
 * The admin list is deliberately not the customer list.
 *
 * getParts() pages at 12 and hides isActive:false, which is right for the
 * storefront and wrong here — an admin calling it without params saw only the
 * twelve newest parts and could never see, let alone re-enable, one they had
 * hidden. This returns everything, newest first.
 */
const getAllParts = asyncHandler(async (req, res) => {
  const parts = await SparePart.find().sort({ createdAt: -1 });
  res.json({ success: true, total: parts.length, parts });
});

// @desc  Get featured parts
// @route GET /api/store/parts/featured
/**
 * `limit` is optional and unset by default, so /featured keeps receiving the
 * full list exactly as before.
 *
 * The home page's shop strip renders five cards and now asks for five. It was
 * previously pulling every featured part in the catalogue — whole documents,
 * `pincodePricing` arrays and image lists included — and throwing all but the
 * first five away on the client, on the landing page's critical path.
 */
const getFeaturedParts = asyncHandler(async (req, res) => {
  const { pincode, limit } = req.query;
  const query = { isFeatured: true, isActive: true };
  if (pincode) Object.assign(query, pincodeFilter(pincode));

  let cursor = SparePart.find(query).sort({ createdAt: -1 });
  const max = Number(limit);
  if (Number.isFinite(max) && max > 0) cursor = cursor.limit(Math.min(max, 100));

  const parts = await cursor;
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
  // $exists:true matches a field explicitly set to null, so that filter alone
  // let nulls through into the category tab strip. Match the type instead.
  const categories = await SparePart.distinct('category', { isActive: true, category: { $type: 'string', $ne: '' } });
  res.json({ success: true, categories: categories.sort() });
});

// @desc  Get single part
const getPart = asyncHandler(async (req, res) => {
  const part = await SparePart.findById(req.params.id);
  if (!part) { res.status(404); throw new Error('Part not found'); }
  res.json({ success: true, part });
});

const toUrl = (f) => f.path.includes('uploads') ? '/uploads' + f.path.split('uploads')[1].replace(/\\/g, '/') : f.path;

/**
 * Parse a JSON field arriving through multipart, without letting bad JSON 500.
 *
 * These three fields were parsed with a bare JSON.parse, so a malformed string
 * threw a SyntaxError straight out of the handler -- reported to the admin as
 * a server fault rather than as a bad field.
 */
const parseMaybeJSON = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error('partController: could not parse JSON field ->', err.message);
    return fallback;
  }
};

/**
 * The customer-visible text on a part.
 *
 * Admin-authored, but rendered on the public storefront and in order emails,
 * so it is cleaned on the way in like any other stored text. Only keys present
 * on the body are returned, so update semantics are unchanged.
 */
const cleanPartText = (body) => {
  const out = {};
  const rules = {
    name: { field: 'Name', max: 200 },
    brand: { field: 'Brand', max: 80 },
    category: { field: 'Category', max: 80 },
    subCategory: { field: 'Sub-category', max: 80 },
  };
  for (const [key, opts] of Object.entries(rules)) {
    if (body[key] !== undefined) out[key] = cleanText(body[key], opts);
  }
  if (body.description !== undefined) {
    out.description = cleanMultiline(body.description, { field: 'Description', max: 4000 });
  }
  for (const key of ['price', 'discountedPrice']) {
    if (body[key] !== undefined && body[key] !== '') {
      out[key] = cleanNumber(body[key], { field: 'Price', min: 0, max: 100000000 });
    }
  }
  if (body.stock !== undefined && body.stock !== '') {
    out.stock = cleanInt(body.stock, { field: 'Stock', min: 0, max: 1000000 });
  }
  return out;
};

// @desc  Create part (admin)
const createPart = asyncHandler(async (req, res) => {
  const images = (req.files || []).map(toUrl);

  const body = { ...req.body };
  body.farmerDetails = parseMaybeJSON(body.farmerDetails, body.farmerDetails);
  body.pincodePricing = parseMaybeJSON(body.pincodePricing, []);
  body.compatibleBikes = parseMaybeJSON(body.compatibleBikes, []);

  const part = await SparePart.create({ ...body, ...cleanPartText(req.body), images });
  res.status(201).json({ success: true, part });
});

// @desc  Update part (admin)
const updatePart = asyncHandler(async (req, res) => {
  const existingPart = await SparePart.findById(req.params.id);
  if (!existingPart) { res.status(404); throw new Error('Part not found'); }

  const body = { ...req.body, ...cleanPartText(req.body) };

  body.farmerDetails = parseMaybeJSON(body.farmerDetails, body.farmerDetails);
  body.pincodePricing = parseMaybeJSON(body.pincodePricing, body.pincodePricing);
  body.compatibleBikes = parseMaybeJSON(body.compatibleBikes, body.compatibleBikes);

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

/**
 * Unit price for one part, resolved the same way the storefront resolves it.
 *
 * The customer is shown a pincode-specific price when the part carries
 * `pincodePricing` for their area (PartCard/PartDetail both do this), but the
 * order used to be priced from `discountedPrice || price` regardless — so the
 * amount charged could differ from the amount displayed. Delivery pincode is
 * the deciding input, and it comes from the order's own delivery address, not
 * from anything the client asserts about price.
 */
const resolveUnitPrice = (part, pincode) => {
  if (pincode && Array.isArray(part.pincodePricing) && part.pincodePricing.length) {
    const match = part.pincodePricing.find((p) => String(p.pincode) === String(pincode).trim());
    if (match && Number(match.price) > 0) return Number(match.price);
  }
  const discounted = Number(part.discountedPrice);
  if (Number.isFinite(discounted) && discounted > 0 && discounted < Number(part.price)) {
    return discounted;
  }
  return Number(part.price) || 0;
};

// @desc  Place order
const placeOrder = asyncHandler(async (req, res) => {
  const { items, deliveryAddress, payment } = req.body;

  if (!items || !items.length) { res.status(400); throw new Error('No items in order'); }
  if (!Array.isArray(items)) { res.status(400); throw new Error('Invalid basket'); }
  // A basket is a basket. Without a ceiling one request can hold thousands of
  // conditional stock updates open.
  if (items.length > 50) {
    res.status(400);
    throw new Error('A single order can contain at most 50 different items');
  }

  // Address is schema-required; failing here gives a readable message instead
  // of a raw Mongoose ValidationError after stock has already been reserved.
  const required = ['street', 'city', 'pincode'];
  const missing = required.filter((k) => !String(deliveryAddress?.[k] || '').trim());
  if (missing.length) {
    res.status(400);
    throw new Error(`Delivery address is incomplete (${missing.join(', ')})`);
  }
  // `state` is schema-required but rarely collected separately in the UI;
  // falling back to the city keeps a valid document instead of a 500.
  /* Built field by field rather than spread, so the stored address holds only
     what the schema defines -- and each part is length-capped and stripped of
     markup, since this text is re-rendered in the admin order view. */
  const city = cleanText(deliveryAddress.city, { field: 'City', max: 80, required: true });
  const address = {
    label: cleanText(deliveryAddress.label, { field: 'Label', max: 40 }) || 'Address',
    street: cleanText(deliveryAddress.street, { field: 'Street address', max: 200, required: true }),
    city,
    // `state` is schema-required but rarely collected separately in the UI;
    // falling back to the city keeps a valid document instead of a 500.
    state: cleanText(deliveryAddress.state, { field: 'State', max: 80 }) || city,
    pincode: cleanPincode(deliveryAddress.pincode),
    lat: cleanNumber(deliveryAddress.lat, { field: 'Latitude', min: -90, max: 90 }),
    lng: cleanNumber(deliveryAddress.lng, { field: 'Longitude', min: -180, max: 180 }),
  };

  // Cash on delivery has been withdrawn. Anything that is not an online
  // payment is rejected here rather than quietly stored as a second method.
  const method = payment?.method || 'online';
  if (method !== 'online') {
    res.status(400);
    throw new Error('Only online payment is available');
  }

  let subtotal = 0;
  const orderItems = [];
  const reserved = [];   // rolled back if anything below fails

  try {
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        res.status(400);
        throw new Error('Invalid quantity');
      }
      // A malformed id would otherwise surface as a Mongoose CastError, which
      // reads as a server fault rather than a bad basket.
      if (!mongoose.Types.ObjectId.isValid(item.product)) {
        res.status(400);
        throw new Error('One of the items is no longer available');
      }

      // Decrement conditionally so two simultaneous orders cannot both pass a
      // read-then-write check and oversell the last unit.
      const part = await SparePart.findOneAndUpdate(
        { _id: item.product, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );

      if (!part) {
        const exists = await SparePart.findById(item.product).select('name stock');
        res.status(400);
        throw new Error(
          exists
            ? `${exists.name} — only ${exists.stock} left in stock`
            : 'One of the items is no longer available'
        );
      }

      reserved.push({ id: part._id, qty });
      const unitPrice = resolveUnitPrice(part, address.pincode);
      if (!(unitPrice > 0)) {
        res.status(400);
        throw new Error(`${part.name} is not available for purchase right now`);
      }
      subtotal += unitPrice * qty;
      orderItems.push({
        product: part._id,
        name: part.name,
        price: unitPrice,
        quantity: qty,
        image: Array.isArray(part.images) ? part.images[0] : undefined,
      });
    }

    const shippingCharge = subtotal > 500 ? 0 : 50;
    const total = subtotal + shippingCharge;

    const order = await Order.create({
      user: req.user._id, items: orderItems, deliveryAddress: address,
      subtotal, shippingCharge, total,
      payment: { method: 'online', status: 'pending' },
      statusHistory: [{ status: 'placed', note: 'Order placed' }],
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
    // Give back everything reserved so a failure part-way through a multi-item
    // order does not silently consume stock.
    await Promise.all(reserved.map((r) =>
      SparePart.findByIdAndUpdate(r.id, { $inc: { stock: r.qty } })
    )).catch((rollbackErr) =>
      console.error('Stock rollback failed ->', rollbackErr.message)
    );
    throw err;
  }
});

// @desc  Get user orders
const getMyOrders = asyncHandler(async (req, res) => {
  // `items.product` is populated so the dashboard can link to a live product
  // page; the item snapshot (name/price/image) is what actually renders, so a
  // product that has since been deleted still shows correctly.
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product', 'name images category brand isActive')
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

// @desc  Get single order
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name phone')
    .populate('items.product', 'name images category brand isActive');
  if (!order) { res.status(404); throw new Error('Order not found'); }
  // The route is only `protect`ed, so without this check any signed-in
  // customer could read anyone else's order (and delivery address) by id.
  const ownerId = order.user?._id ? String(order.user._id) : String(order.user);
  if (req.user.role !== 'admin' && ownerId !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }
  res.json({ success: true, order });
});

// @desc  Create Razorpay order for parts
const createPartPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403); throw new Error('Not authorized');
  }
  if (order.payment?.status === 'paid') {
    res.status(400); throw new Error('This order has already been paid');
  }
  const razorpayOrder = await createRazorpayOrder({ amount: order.total, receipt: `ord_${order._id}` });
  res.json({ success: true, order: razorpayOrder, key: process.env.RAZORPAY_KEY_ID });
});

// @desc  Verify parts payment
const verifyPartPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const isValid = verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!isValid) { res.status(400); throw new Error('Payment verification failed'); }

  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403); throw new Error('Not authorized');
  }
  if (order.payment?.status === 'paid') {
    // Razorpay can fire the handler twice; the second call must not append a
    // duplicate history entry.
    return res.json({ success: true, order });
  }
  order.payment.status = 'paid';
  order.payment.transactionId = razorpay_payment_id;
  order.payment.razorpayOrderId = razorpay_order_id;
  order.payment.paidAt = new Date();
  order.status = 'confirmed';
  order.statusHistory.push({ status: 'confirmed', note: 'Payment confirmed' });
  await order.save();

  res.json({ success: true, order });
});

// Stock is taken at order time, so anything that ends an order without a
// delivery has to give it back. Guarded by a flag so a double cancel cannot
// credit the same units twice.
const restoreOrderStock = async (order, reason) => {
  if (order.stockRestored) return false;
  await Promise.all((order.items || []).map((i) =>
    SparePart.findByIdAndUpdate(i.product, { $inc: { stock: i.quantity } })
  ));
  order.stockRestored = true;
  order.statusHistory.push({ status: order.status, note: `Stock returned (${reason})` });
  return true;
};

// @desc  Update order status (admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }

  const wasCancelled = order.status === 'cancelled';
  order.status = status;
  order.statusHistory.push({ status, note });

  if (status === 'cancelled' && !wasCancelled) {
    await restoreOrderStock(order, 'order cancelled');
  }

  await order.save();
  res.json({ success: true, order });
});

// @desc  Cancel my own order
// @route PUT /api/store/orders/:id/cancel
// @access Private
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  if (String(order.user) !== String(req.user._id)) {
    res.status(403); throw new Error('Not authorized');
  }
  if (!['placed', 'confirmed'].includes(order.status)) {
    res.status(400); throw new Error('This order can no longer be cancelled');
  }
  if (order.payment?.status === 'paid') {
    res.status(400); throw new Error('This order is paid — please contact support to cancel and refund');
  }

  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', note: 'Cancelled by customer' });
  await restoreOrderStock(order, 'cancelled by customer');
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

module.exports = {
  cancelMyOrder,
  getParts,
  getAllParts,
  getPart,
  getPartCategories,
  getFeaturedParts,
  getBestsellerParts,
  getUpcomingParts,
  getRecentParts,
  searchParts,
  createPart,
  updatePart,
  deletePart,
  placeOrder,
  getMyOrders,
  getOrder,
  createPartPayment,
  verifyPartPayment,
  updateOrderStatus,
  getAllOrders,
};

