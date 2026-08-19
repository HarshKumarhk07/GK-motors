const asyncHandler = require('express-async-handler');
const RentalCar = require('../models/RentalCar');
const RentalBooking = require('../models/RentalBooking');
const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayInstance = null;
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

const dayDiff = (start, end) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

const hourDiff = (startDate, startTime, endDate, endTime) => {
  const s = new Date(`${new Date(startDate).toISOString().split('T')[0]}T${startTime || '00:00'}:00`);
  const e = new Date(`${new Date(endDate).toISOString().split('T')[0]}T${endTime || '00:00'}:00`);
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
};

// ── RENTAL CARS ───────────────────────────────────────────────

// @desc  Get all rental cars (with filters)
// @route GET /api/rentals/cars
const getRentalCars = asyncHandler(async (req, res) => {
  const {
    brand, transmission, fuelType, seats, minPrice, maxPrice,
    city, sort, page = 1, limit = 12, search, isAdmin
  } = req.query;

  const query = isAdmin === 'true' ? {} : { status: { $in: ['available', 'rented', null] } };

  if (brand) query.brand = new RegExp(brand, 'i');
  if (transmission) query.transmission = transmission;
  if (fuelType) query.fuelType = fuelType;
  if (seats) query.seats = Number(seats);
  if (city) query['location.city'] = new RegExp(city, 'i');
  if (minPrice || maxPrice) {
    query.pricePerDay = {
      ...(minPrice && { $gte: Number(minPrice) }),
      ...(maxPrice && { $lte: Number(maxPrice) }),
    };
  }
  if (search) query.$or = [
    { title: new RegExp(search, 'i') },
    { brand: new RegExp(search, 'i') },
    { model: new RegExp(search, 'i') },
  ];

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { pricePerDay: 1 },
    price_desc: { pricePerDay: -1 },
    popular: { views: -1 },
  };

  const total = await RentalCar.countDocuments(query);
  const cars = await RentalCar.find(query)
    .sort(sortOptions[sort] || { createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    cars,
  });
});

// @desc  Get single rental car
// @route GET /api/rentals/cars/:id
const getRentalCar = asyncHandler(async (req, res) => {
  const car = await RentalCar.findById(req.params.id);
  if (!car) { res.status(404); throw new Error('Rental car not found'); }
  car.views += 1;
  await car.save();
  res.json({ success: true, car });
});

const normalizeRentalCarBody = (body) => {
  if (typeof body.location === 'string') body.location = JSON.parse(body.location);
  if (typeof body.dropLocation === 'string') body.dropLocation = JSON.parse(body.dropLocation);
  if (typeof body.features === 'string') body.features = JSON.parse(body.features);

  // rentalUnits arrives as `rentalUnits[]` field — multer/body-parser may give array or single
  let units = body['rentalUnits[]'] ?? body.rentalUnits;
  if (units !== undefined) {
    if (typeof units === 'string') units = [units];
    if (Array.isArray(units)) {
      body.rentalUnits = units.filter(u => u === 'day' || u === 'hour');
    }
    delete body['rentalUnits[]'];
  }

  const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
  if (body.securityDepositCompulsory !== undefined) {
    body.securityDepositCompulsory = toBool(body.securityDepositCompulsory);
  }
  if (body.securityDepositRefundable !== undefined) {
    body.securityDepositRefundable = toBool(body.securityDepositRefundable);
  }
  if (body.isFeatured !== undefined) {
    body.isFeatured = body.isFeatured === true || body.isFeatured === 'true';
  }

  // Coerce other boolean rental-feature fields sent as form-data strings
  ['airConditioning', 'gps', 'bluetooth', 'musicSystem', 'powerWindows', 'powerSteering'].forEach(k => {
    if (body[k] !== undefined) {
      body[k] = body[k] === true || body[k] === 'true';
    }
  });

  if (body.carNumber) body.carNumber = body.carNumber.trim().toUpperCase();
  if (body.registrationNumber) body.registrationNumber = body.registrationNumber.trim().toUpperCase();

  return body;
};

// @desc  Create rental car (admin)
// @route POST /api/rentals/cars
const createRentalCar = asyncHandler(async (req, res) => {
  const images = req.files ? req.files.map((f) => f.path) : [];
  const body = normalizeRentalCarBody({ ...req.body });
  const car = await RentalCar.create({ ...body, images });
  res.status(201).json({ success: true, car });
});

// @desc  Update rental car (admin)
// @route PUT /api/rentals/cars/:id
const updateRentalCar = asyncHandler(async (req, res) => {
  const car = await RentalCar.findById(req.params.id);
  if (!car) { res.status(404); throw new Error('Rental car not found'); }
  const body = normalizeRentalCarBody({ ...req.body });

  const existing = body.existingImages
    ? (Array.isArray(body.existingImages) ? body.existingImages : [body.existingImages])
    : [];
  const newUploads = (req.files || []).map(f => f.path);
  if (existing.length > 0 || newUploads.length > 0) body.images = [...existing, ...newUploads];
  delete body.existingImages;

  // Use explicit $set so that false values (e.g. securityDepositCompulsory: false)
  // are written to the DB instead of being silently merged with defaults.
  const updated = await RentalCar.findByIdAndUpdate(
    req.params.id,
    { $set: body },
    { new: true, runValidators: true }
  );
  res.json({ success: true, car: updated });
});

// @desc  Delete rental car (admin)
// @route DELETE /api/rentals/cars/:id
const deleteRentalCar = asyncHandler(async (req, res) => {
  const car = await RentalCar.findByIdAndDelete(req.params.id);
  if (!car) { res.status(404); throw new Error('Rental car not found'); }
  res.json({ success: true, message: 'Rental car deleted' });
});

// ── RENTAL BOOKINGS ───────────────────────────────────────────

// @desc  Create rental booking
// @route POST /api/rentals/bookings
const createRentalBooking = asyncHandler(async (req, res) => {
  // Body comes as multipart/form-data; address may arrive as a JSON string
  const body = { ...req.body };
  if (typeof body.pickupAddress === 'string') {
    try { body.pickupAddress = JSON.parse(body.pickupAddress); } catch { body.pickupAddress = {}; }
  }

  const {
    rentalCar, pickupDate, returnDate, pickupTime, returnTime,
    pickupAddress, driverLicense, contactPhone, fullName, notes, paymentMethod,
    rentalUnit, aadharNumber, panNumber, paymentPlan: rawPlan,
    includeSecurityDeposit: rawInclude,
  } = body;
  const paymentPlan = ['full', 'advance', 'on_drop'].includes(rawPlan) ? rawPlan : 'full';
  const userOptedInForDeposit = rawInclude === true || rawInclude === 'true';

  // KYC validation
  if (!aadharNumber || !/^\d{12}$/.test(String(aadharNumber).replace(/\s/g, ''))) {
    res.status(400);
    throw new Error('Valid 12-digit Aadhar number is required');
  }
  if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(panNumber).toUpperCase())) {
    res.status(400);
    throw new Error('Valid PAN number is required (e.g. ABCDE1234F)');
  }

  const car = await RentalCar.findById(rentalCar);
  if (!car) { res.status(404); throw new Error('Rental car not found'); }
  if (car.status !== 'available') { res.status(400); throw new Error('This car is not available for rent'); }

  // Auto-derive allowed units from prices + any explicit rentalUnits flag.
  // If pricePerHour > 0, hour mode is enabled even when rentalUnits doesn't list it.
  const fromPrices = [];
  if (car.pricePerDay > 0) fromPrices.push('day');
  if (car.pricePerHour > 0) fromPrices.push('hour');
  const explicit = Array.isArray(car.rentalUnits) ? car.rentalUnits.filter(u => u === 'day' || u === 'hour') : [];
  const allowedUnits = Array.from(new Set([...explicit, ...fromPrices]));
  if (!allowedUnits.length) allowedUnits.push('day');

  const unit = rentalUnit && allowedUnits.includes(rentalUnit) ? rentalUnit : allowedUnits[0];
  if (unit === 'hour' && (!car.pricePerHour || car.pricePerHour <= 0)) {
    res.status(400);
    throw new Error('Hourly rental is not available for this car');
  }

  let totalDays = 0;
  let totalHours = 0;
  let subtotal = 0;

  if (unit === 'hour') {
    totalHours = hourDiff(pickupDate, pickupTime, returnDate, returnTime);
    if (totalHours < (car.minRentalHours || 1)) {
      res.status(400);
      throw new Error(`Minimum rental period is ${car.minRentalHours} hour(s)`);
    }
    if (car.maxRentalHours && totalHours > car.maxRentalHours) {
      res.status(400);
      throw new Error(`Maximum rental period is ${car.maxRentalHours} hour(s)`);
    }
    subtotal = totalHours * car.pricePerHour;
  } else {
    totalDays = dayDiff(pickupDate, returnDate);
    if (totalDays < (car.minRentalDays || 1)) {
      res.status(400);
      throw new Error(`Minimum rental period is ${car.minRentalDays} day(s)`);
    }
    if (car.maxRentalDays && totalDays > car.maxRentalDays) {
      res.status(400);
      throw new Error(`Maximum rental period is ${car.maxRentalDays} day(s)`);
    }
    subtotal = totalDays * car.pricePerDay;
  }

  // Conflict check — only paid/active bookings block. Stale 'requested' bookings
  // older than 15 minutes are ignored (user closed Razorpay / payment failed).
  // Bookings created by the SAME user are also ignored, so a user can retry their own pending booking.
  const STALE_REQUESTED_MS = 15 * 60 * 1000;
  const cutoff = new Date(Date.now() - STALE_REQUESTED_MS);

  const candidates = await RentalBooking.find({
    rentalCar,
    user: { $ne: req.user._id },
    pickupDate: { $lte: new Date(returnDate) },
    returnDate: { $gte: new Date(pickupDate) },
    $or: [
      { status: { $in: ['confirmed', 'active'] } },
      { status: 'requested', createdAt: { $gte: cutoff } },
    ],
  });

  if (candidates.length) {
    const requestedStart = new Date(`${new Date(pickupDate).toISOString().split('T')[0]}T${pickupTime || '00:00'}:00`).getTime();
    const requestedEnd = new Date(`${new Date(returnDate).toISOString().split('T')[0]}T${returnTime || '23:59'}:00`).getTime();

    const realConflict = candidates.find(c => {
      const eStart = new Date(`${new Date(c.pickupDate).toISOString().split('T')[0]}T${c.pickupTime || '00:00'}:00`).getTime();
      const eEnd = new Date(`${new Date(c.returnDate).toISOString().split('T')[0]}T${c.returnTime || '23:59'}:00`).getTime();
      return requestedStart < eEnd && requestedEnd > eStart;
    });

    if (realConflict) {
      res.status(400);
      throw new Error('Car is already booked for the selected time window');
    }
  }

  // Deposit is included if compulsory OR if optional and user opted in
  const depositCompulsory = car.securityDepositCompulsory !== false;
  const includeDeposit = depositCompulsory || userOptedInForDeposit;
  const effectiveDeposit = includeDeposit ? (car.securityDeposit || 0) : 0;
  const totalAmount = subtotal + effectiveDeposit;

  const booking = await RentalBooking.create({
    user: req.user._id,
    rentalCar,
    carSnapshot: {
      title: car.title,
      brand: car.brand,
      model: car.model,
      year: car.year,
      image: car.images?.[0],
      pricePerDay: car.pricePerDay,
      carNumber: car.carNumber,
      registrationNumber: car.registrationNumber,
      rcNumber: car.rcNumber,
      chassisNumber: car.chassisNumber,
      engineNumber: car.engineNumber,
    },
    pickupDate, returnDate, pickupTime, returnTime,
    rentalUnit: unit,
    totalDays, totalHours,
    pricePerDay: car.pricePerDay,
    pricePerHour: car.pricePerHour || 0,
    securityDeposit: effectiveDeposit,
    subtotal, totalAmount,
    pickupAddress, driverLicense, contactPhone, fullName, notes,
    kyc: {
      aadharNumber: String(aadharNumber).replace(/\s/g, ''),
      panNumber: String(panNumber).toUpperCase(),
      aadharImage: req.files?.aadharImage?.[0]?.path || null,
      panImage: req.files?.panImage?.[0]?.path || null,
      licenseImage: req.files?.licenseImage?.[0]?.path || null,
    },
    payment: (() => {
      const advanceQuote = effectiveDeposit > 0 ? effectiveDeposit : Math.round(totalAmount * 0.25);
      const advanceAmount = paymentPlan === 'full' ? totalAmount
                          : paymentPlan === 'advance' ? Math.min(totalAmount, advanceQuote)
                          : 0;
      return {
        method: paymentPlan === 'on_drop' ? 'cod' : (paymentMethod || 'online'),
        status: 'pending',
        plan: paymentPlan,
        advanceAmount,
        balanceDue: Math.max(0, totalAmount - advanceAmount),
        amountPaid: 0,
      };
    })(),
    statusHistory: [{ status: 'requested', note: `Booking created (plan: ${paymentPlan})` }],
  });

  // Decide whether to charge anything online now
  const chargeNow = booking.payment.advanceAmount > 0 && paymentPlan !== 'on_drop';
  if (chargeNow) {
    const razorpay = getRazorpay();
    if (!razorpay) {
      res.status(500);
      throw new Error('Online payment is not configured. Please contact support.');
    }
    try {
      const options = {
        amount: Math.round(booking.payment.advanceAmount * 100),
        currency: 'INR',
        receipt: `rental_${booking._id}`,
      };
      const order = await razorpay.orders.create(options);
      booking.payment.razorpayOrderId = order.id;
      await booking.save();
      return res.status(201).json({ success: true, booking, order, key: process.env.RAZORPAY_KEY_ID });
    } catch (err) {
      res.status(500);
      throw new Error(err?.error?.description || err?.message || 'Failed to create payment order');
    }
  }

  res.status(201).json({ success: true, booking });
});

// @desc  Verify rental payment
// @route POST /api/rentals/bookings/verify
const verifyRentalPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    const booking = await RentalBooking.findById(bookingId);
    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    const plan = booking.payment.plan || 'full';
    const advance = booking.payment.advanceAmount || 0;

    booking.payment.razorpayPaymentId = razorpay_payment_id;
    booking.payment.razorpaySignature = razorpay_signature;
    booking.payment.amountPaid = (booking.payment.amountPaid || 0) + advance;
    booking.payment.paidAt = new Date();

    if (plan === 'full') {
      booking.payment.status = 'paid';
      booking.payment.balanceDue = 0;
      booking.statusHistory.push({ status: 'confirmed', note: 'Full payment verified' });
    } else if (plan === 'advance') {
      booking.payment.status = 'advance_paid';
      booking.payment.balanceDue = Math.max(0, booking.totalAmount - booking.payment.amountPaid);
      booking.statusHistory.push({
        status: 'confirmed',
        note: `Advance ₹${advance.toLocaleString('en-IN')} paid; balance ₹${booking.payment.balanceDue.toLocaleString('en-IN')} due at drop`,
      });
    } else {
      booking.payment.status = 'paid';
      booking.statusHistory.push({ status: 'confirmed', note: 'Payment verified' });
    }
    booking.status = 'confirmed';
    await booking.save();

    res.json({ success: true, booking });
  } else {
    res.status(400);
    throw new Error('Invalid signature');
  }
});

// @desc  Admin marks the balance amount as collected at drop time
// @route PUT /api/rentals/bookings/:id/collect-balance
const collectRentalBalance = asyncHandler(async (req, res) => {
  const { method, amount, note } = req.body;
  const booking = await RentalBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Rental booking not found'); }

  const due = Number(booking.payment.balanceDue || 0);
  if (due <= 0) {
    res.status(400);
    throw new Error('No balance is due on this booking');
  }
  const collected = Number(amount) > 0 ? Number(amount) : due;
  if (collected > due) {
    res.status(400);
    throw new Error(`Amount exceeds balance due (₹${due.toLocaleString('en-IN')})`);
  }

  booking.payment.amountPaid = (booking.payment.amountPaid || 0) + collected;
  booking.payment.balanceDue = Math.max(0, due - collected);
  booking.payment.balanceCollectedAt = new Date();
  booking.payment.balanceCollectedBy = req.user?._id;
  booking.payment.balanceMethod = ['cash', 'online', 'upi', 'card'].includes(method) ? method : 'cash';

  if (booking.payment.balanceDue === 0) {
    booking.payment.status = 'paid';
  }
  booking.statusHistory.push({
    status: booking.status,
    note: `Balance ₹${collected.toLocaleString('en-IN')} collected via ${booking.payment.balanceMethod}${note ? ` — ${note}` : ''}`,
  });
  await booking.save();
  res.json({ success: true, booking });
});

// @desc  Get current user's rental bookings
// @route GET /api/rentals/bookings/my
const getMyRentalBookings = asyncHandler(async (req, res) => {
  const bookings = await RentalBooking.find({ user: req.user._id })
     .populate('rentalCar')
    .sort({ createdAt: -1 });
  res.json({ success: true, bookings });
});

// @desc  Get all rental bookings (admin)
// @route GET /api/rentals/bookings
const getAllRentalBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status: { $in: status.split(',') } } : {};
  const total = await RentalBooking.countDocuments(query);
  const bookings = await RentalBooking.find(query)
    .populate('user', 'name phone email')
     .populate('rentalCar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, bookings });
});

// @desc  Update rental booking status (admin)
// @route PUT /api/rentals/bookings/:id/status
const updateRentalBookingStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const booking = await RentalBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Rental booking not found'); }

  if (status === 'completed' && booking.payment?.balanceDue > 0) {
    res.status(400);
    throw new Error('Cannot complete booking with pending payment balance. Please collect or pay the balance first.');
  }

  booking.status = status;
  booking.statusHistory.push({ status, note });

  if (status === 'active') {
    await RentalCar.findByIdAndUpdate(booking.rentalCar, { status: 'rented' });
  } else {
    // If status is anything other than 'active', the car should be available (unless admin manually marked it otherwise)
    // This handles moving back to 'confirmed' or moving to 'completed'/'cancelled'
    await RentalCar.findByIdAndUpdate(booking.rentalCar, { status: 'available' });
  }

  await booking.save();
  res.json({ success: true, booking });
});

// @desc  Cancel my rental booking
// @route PUT /api/rentals/bookings/:id/cancel
const cancelMyRentalBooking = asyncHandler(async (req, res) => {
  const booking = await RentalBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Rental booking not found'); }
  if (booking.user.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Not authorized');
  }
  if (!['requested', 'confirmed'].includes(booking.status)) {
    res.status(400); throw new Error('Cannot cancel this booking now');
  }
  booking.status = 'cancelled';
  booking.statusHistory.push({ status: 'cancelled', note: 'Cancelled by user' });
  await booking.save();
  res.json({ success: true, booking });
});


// ── LOCATION TRACKING ─────────────────────────────────────────

const LIVE_TRACK_CAR_FIELDS = 'title brand model year images registrationNumber carNumber rcNumber chassisNumber engineNumber color bodyType fuelType transmission seats doors location dropLocation';

// @desc  Get a single booking's last known location
// @route GET /api/rentals/bookings/:id/location
const getBookingLocation = asyncHandler(async (req, res) => {
  const booking = await RentalBooking.findById(req.params.id)
    .select('currentLocation carSnapshot status user rentalCar pickupDate returnDate pickupTime returnTime contactPhone fullName payment')
    .populate('user', 'name phone email')
    .populate('rentalCar', LIVE_TRACK_CAR_FIELDS);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }
  res.json({ success: true, location: booking.currentLocation, booking });
});
// @desc  Get all active bookings with their locations
// @route GET /api/rentals/bookings/active-locations
const getActiveLocations = asyncHandler(async (req, res) => {
  const bookings = await RentalBooking.find({ status: 'active' })
    .select('currentLocation carSnapshot user status rentalCar pickupDate returnDate pickupTime returnTime contactPhone fullName payment')
    .populate('user', 'name phone email')
    .populate('rentalCar', LIVE_TRACK_CAR_FIELDS);
  res.json({ success: true, bookings });
});


// @desc  Create Razorpay order for pending balance
// @route POST /api/rentals/bookings/:id/pay-balance
const createRentalBalanceOrder = asyncHandler(async (req, res) => {
  const booking = await RentalBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Rental booking not found'); }
  if (booking.user.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Not authorized');
  }

  const due = Number(booking.payment.balanceDue || 0);
  if (due <= 0) {
    res.status(400); throw new Error('No balance is due on this booking');
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    res.status(500); throw new Error('Online payment is not configured');
  }

  try {
    const options = {
      amount: Math.round(due * 100),
      currency: 'INR',
      receipt: `balance_${booking._id}`,
    };
    const order = await razorpay.orders.create(options);
    booking.payment.razorpayOrderId = order.id; // temporary storage for verification
    await booking.save();
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500); throw new Error(err?.message || 'Failed to create payment order');
  }
});

// @desc  Verify balance payment
// @route POST /api/rentals/bookings/:id/verify-balance
const verifyRentalBalancePayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const booking = await RentalBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Rental booking not found'); }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    const due = Number(booking.payment.balanceDue || 0);
    booking.payment.amountPaid = (booking.payment.amountPaid || 0) + due;
    booking.payment.balanceDue = 0;
    booking.payment.status = 'paid';
    booking.payment.razorpayPaymentId = razorpay_payment_id;
    booking.payment.paidAt = new Date();
    booking.payment.balanceCollectedAt = new Date();
    booking.payment.balanceMethod = 'online';

    booking.statusHistory.push({
      status: booking.status,
      note: `Remaining balance ₹${due.toLocaleString('en-IN')} paid online via Razorpay`,
    });

    await booking.save();
    res.json({ success: true, booking });
  } else {
    res.status(400); throw new Error('Payment verification failed');
  }
});

module.exports = {
  getRentalCars, getRentalCar, createRentalCar, updateRentalCar, deleteRentalCar,
  createRentalBooking, getMyRentalBookings, getAllRentalBookings,
  updateRentalBookingStatus, cancelMyRentalBooking, verifyRentalPayment,
  collectRentalBalance, createRentalBalanceOrder, verifyRentalBalancePayment,
  getBookingLocation, getActiveLocations
};
