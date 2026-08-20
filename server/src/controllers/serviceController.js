const asyncHandler = require('express-async-handler');
const ServiceBooking = require('../models/ServiceBooking');
const ServiceType = require('../models/ServiceType');
const ServiceCar = require('../models/ServiceCar');
const { createOrder, verifyPayment } = require('../services/paymentService');
const { sendBookingConfirmationEmail } = require('../services/emailService');
const { istNow, slotMinutes } = require('../utils/istTime');

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
];
// How many bookings can share one slot before it is shown as full.
const SLOT_CAPACITY = Number(process.env.SERVICE_SLOT_CAPACITY || 3);

// The workshop. Used as the drop point when the customer collects the car
// themselves, and printed in the confirmation email.
const SERVICE_CENTER_ADDRESS = {
  label: 'GK Motors Service Centre',
  street: 'Sheela By Pass, near New Railway Crossing, Jasbir Colony, Sector-5',
  city: 'Rohtak',
  state: 'Haryana',
  pincode: '124001',
  fullAddress:
    'GK Motors, Sheela By Pass, near New Railway Crossing, Jasbir Colony, Sector-5, Rohtak, Haryana 124001',
};

// Doorstep pickup runs 09:00-18:00. The 18:00 slot is excluded: it is the last
// bookable slot, and there is no room after it for the driver to collect the
// car and get it back to the workshop the same day.
const PICKUP_DROP_FIRST_HOUR = 9;
const PICKUP_DROP_LAST_HOUR = 18;   // exclusive
/**
 * Can we run a doorstep pickup for this slot?
 *
 * Two conditions: the slot sits inside the 9-to-6 window, and — for a booking
 * made today — the slot has not already gone past in Rohtak. Judged in IST,
 * not in whatever timezone this process runs in.
 */
const isPickupDropAvailable = (time, date) => {
  const mins = slotMinutes(time);
  if (mins === null) return false;

  const hour = Math.floor(mins / 60);
  if (hour < PICKUP_DROP_FIRST_HOUR || hour >= PICKUP_DROP_LAST_HOUR) return false;

  if (date) {
    const now = istNow();
    if (String(date).slice(0, 10) === now.date && mins <= now.minutes) return false;
  }
  return true;
};

// Copy only the address fields we store — never whatever else the client sent.
const cleanAddress = (a) => ({
  label: a.label || 'Address',
  street: String(a.street || '').trim(),
  city: String(a.city || '').trim(),
  state: String(a.state || '').trim(),
  pincode: String(a.pincode || '').trim(),
  lat: typeof a.lat === 'number' ? a.lat : undefined,
  lng: typeof a.lng === 'number' ? a.lng : undefined,
});
const MAX_BOOKING_DAYS_AHEAD = 30;

// ── Legacy single-service booking (kept for backward compatibility) ────────
// @desc  Create service booking
// @route POST /api/services
const createBooking = asyncHandler(async (req, res) => {
  const booking = await ServiceBooking.create({
    ...req.body,
    user: req.user._id,
    statusHistory: [{ status: 'requested', note: 'Booking created' }],
  });
  res.status(201).json({ success: true, booking });
});

// ── GK Motors: car + multiple services booking ────────────────────────────
// @desc  Create a service booking with a selected car and one or more packages
// @route POST /api/services/book
// @access Private
const createServiceBooking = asyncHandler(async (req, res) => {
  const {
    selectedCar, services, scheduledDate, scheduledTime,
    address, totalAmount, problemDescription, pickupDrop,
  } = req.body;

  // ── Car ──
  if (!selectedCar || !selectedCar.brand || !selectedCar.model || !selectedCar.year) {
    res.status(400);
    throw new Error('Car brand, model and year are required');
  }
  const year = Number(selectedCar.year);
  if (Number.isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1) {
    res.status(400);
    throw new Error('Please provide a valid car year');
  }

  // A catalogue car must still exist and be active at booking time.
  if (selectedCar.carId && selectedCar.carId !== 'manual' && !selectedCar.isManualEntry) {
    const car = await ServiceCar.findById(selectedCar.carId).catch(() => null);
    if (!car || !car.isActive) {
      res.status(400);
      throw new Error('The selected car is no longer available. Please pick another.');
    }
  }

  // ── Services ──
  if (!Array.isArray(services) || services.length === 0) {
    res.status(400);
    throw new Error('At least one service is required');
  }

  const ids = services.map((s) => s.serviceType).filter(Boolean);
  if (ids.length !== services.length) {
    res.status(400);
    throw new Error('Every service must reference a valid service type');
  }
  if (new Set(ids.map(String)).size !== ids.length) {
    res.status(400);
    throw new Error('Duplicate services in the request');
  }

  const types = await ServiceType.find({ _id: { $in: ids }, isActive: true });
  if (types.length !== ids.length) {
    res.status(400);
    throw new Error('One or more selected services are no longer available');
  }

  // Price is resolved server-side. The client's numbers are never trusted:
  // per-car override first, then the package base price.
  let carPriceMap = new Map();
  if (selectedCar.carId && selectedCar.carId !== 'manual' && !selectedCar.isManualEntry) {
    const car = await ServiceCar.findById(selectedCar.carId).catch(() => null);
    if (car) {
      carPriceMap = new Map(
        (car.servicePrices || []).map((sp) => [String(sp.serviceType), sp.price])
      );
    }
  }

  const typeMap = new Map(types.map((t) => [String(t._id), t]));
  const pricedServices = services.map((s) => {
    const t = typeMap.get(String(s.serviceType));
    const price = carPriceMap.has(String(s.serviceType))
      ? carPriceMap.get(String(s.serviceType))
      : (t.basePrice || 0);
    return {
      serviceType: t._id,
      name: t.label,
      price,
      category: t.categoryName || s.category || '',
      categoryId: String(t.categoryId ?? s.categoryId ?? ''),
      tier: t.tier || 'single',
    };
  });

  if (pricedServices.some((s) => !s.price || s.price <= 0)) {
    res.status(400);
    throw new Error('One or more selected services have no price set. Please contact support.');
  }

  const calculatedTotal = pricedServices.reduce((sum, s) => sum + s.price, 0);

  // Client total is advisory — reject a mismatch rather than silently correcting,
  // so a stale price in the cart cannot surprise the customer at payment.
  if (totalAmount !== undefined && Math.abs(calculatedTotal - Number(totalAmount)) > 1) {
    res.status(400);
    throw new Error(
      `Prices have changed since you added these services (total is now ₹${calculatedTotal.toLocaleString('en-IN')}). Please review your cart.`
    );
  }

  // ── Schedule ──
  if (!scheduledDate || !scheduledTime) {
    res.status(400);
    throw new Error('Schedule date and time are required');
  }
  if (!TIME_SLOTS.includes(scheduledTime)) {
    res.status(400);
    throw new Error('Please choose a valid time slot between 09:00 and 18:00');
  }
  const when = new Date(scheduledDate);
  if (Number.isNaN(when.getTime())) {
    res.status(400);
    throw new Error('Invalid schedule date');
  }
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const latest = new Date(startOfToday);
  latest.setDate(latest.getDate() + MAX_BOOKING_DAYS_AHEAD);
  if (when < startOfToday) {
    res.status(400);
    throw new Error('Cannot book a service in the past');
  }
  if (when > latest) {
    res.status(400);
    throw new Error(`Bookings can only be made up to ${MAX_BOOKING_DAYS_AHEAD} days ahead`);
  }

  // ── Address ──
  if (!address || !address.street || !address.city || !address.pincode) {
    res.status(400);
    throw new Error('Complete address is required');
  }
  if (!/^[1-9]\d{5}$/.test(String(address.pincode).trim())) {
    res.status(400);
    throw new Error('Pincode must be 6 digits and cannot start with 0');
  }

  // ── Pickup & drop ──
  // Re-validated here rather than trusted: the client disables the option
  // outside 09:00-17:59, but nothing stops a crafted request.
  const pd = {
    enabled: false,
    dropType: 'service_center',
    pickupAddress: undefined,
    dropAddress: undefined,
  };

  if (pickupDrop && pickupDrop.enabled) {
    if (!isPickupDropAvailable(scheduledTime, scheduledDate)) {
      res.status(400);
      throw new Error('Doorstep pickup and drop is only available between 9:00 AM and 6:00 PM');
    }
    if (!pickupDrop.pickupAddress || !pickupDrop.pickupAddress.street || !pickupDrop.pickupAddress.city) {
      res.status(400);
      throw new Error('A pickup address is required for doorstep pickup');
    }

    const dropType = ['same', 'different', 'service_center'].includes(pickupDrop.dropType)
      ? pickupDrop.dropType
      : 'service_center';

    if (dropType === 'different'
        && (!pickupDrop.dropAddress || !pickupDrop.dropAddress.street || !pickupDrop.dropAddress.city)) {
      res.status(400);
      throw new Error('A drop address is required when returning the car to a different address');
    }

    pd.enabled = true;
    pd.pickupAddress = cleanAddress(pickupDrop.pickupAddress);
    pd.dropType = dropType;

    if (dropType === 'same') {
      pd.dropAddress = pd.pickupAddress;
    } else if (dropType === 'different') {
      pd.dropAddress = cleanAddress(pickupDrop.dropAddress);
    } else {
      pd.dropAddress = cleanAddress(SERVICE_CENTER_ADDRESS);
    }
  }

  const booking = await ServiceBooking.create({
    user: req.user._id,
    selectedCar: {
      carId: selectedCar.isManualEntry ? 'manual' : String(selectedCar.carId || ''),
      brand: String(selectedCar.brand).trim(),
      model: String(selectedCar.model).trim(),
      year,
      fuelType: selectedCar.fuelType || 'petrol',
      transmission: selectedCar.transmission || 'manual',
      image: selectedCar.image || null,
      isManualEntry: Boolean(selectedCar.isManualEntry),
    },
    services: pricedServices,
    // Mirror into the legacy fields so the existing admin table keeps working.
    bikeBrand: String(selectedCar.brand).trim(),
    bikeModel: String(selectedCar.model).trim(),
    bikeYear: year,
    serviceLabel: pricedServices.map((s) => s.name).join(', '),
    problemDescription,
    isPickupDrop: pd.enabled,   // legacy mirror of pickupDrop.enabled
    pickupDrop: pd,
    address: {
      street: address.street, city: address.city, state: address.state,
      pincode: String(address.pincode).trim(), lat: address.lat, lng: address.lng,
    },
    scheduledDate: when,
    scheduledTime,
    totalAmount: calculatedTotal,
    estimatedCost: calculatedTotal,
    payment: { method: 'online', status: 'pending' },
    statusHistory: [{ status: 'requested', note: 'Service booking created' }],
  });

  // Confirmation email. Deliberately after the booking is committed and
  // deliberately not awaited into the response path — a mail outage must not
  // cost the customer a booking they have already been charged for.
  if (req.user.email) {
    sendBookingConfirmationEmail(req.user, booking, SERVICE_CENTER_ADDRESS)
      .catch((err) => console.error('[serviceController.bookingEmail]', err.message));
  }

  res.status(201).json({ success: true, booking });
});

// @desc  Service categories / packages for the booking flow
// @route GET /api/services/categories
// @access Public
const getServiceCategories = asyncHandler(async (req, res) => {
  const packages = await ServiceType.find({ isActive: true })
    .select('value label price desc image basePrice categoryType categoryId categoryName tier order')
    .sort({ categoryId: 1, order: 1 });

  // Group into the 12 categories for convenience; the client can also use the
  // flat list. Uncategorised legacy types are returned but not grouped.
  const grouped = {};
  packages.forEach((p) => {
    if (p.categoryId == null) return;
    if (!grouped[p.categoryId]) {
      grouped[p.categoryId] = { categoryId: p.categoryId, categoryName: p.categoryName, packages: [] };
    }
    grouped[p.categoryId].packages.push(p);
  });

  res.json({
    success: true,
    categories: packages,                    // flat list (spec-compatible)
    grouped: Object.values(grouped),         // grouped by categoryId
  });
});

// @desc  Which time slots are still bookable on a given date
// @route GET /api/services/availability?date=YYYY-MM-DD
// @access Public
const getAvailability = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('A date is required');
  }
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) {
    res.status(400);
    throw new Error('Invalid date');
  }
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);

  const booked = await ServiceBooking.aggregate([
    {
      $match: {
        scheduledDate: { $gte: start, $lt: end },
        status: { $in: ['requested', 'accepted', 'in_progress'] },
      },
    },
    { $group: { _id: '$scheduledTime', count: { $sum: 1 } } },
  ]);
  const counts = new Map(booked.map((b) => [b._id, b.count]));

  // Individual slots close as they pass — in Rohtak, not wherever this process
  // happens to be running. On a UTC host, server-local time is 5h30m behind
  // IST, which kept already-finished evening slots on sale.
  const now = istNow();
  const isToday = String(date).slice(0, 10) === now.date;

  const slots = TIME_SLOTS.map((time) => {
    const used = counts.get(time) || 0;
    let available = used < SLOT_CAPACITY;
    if (available && isToday) {
      const mins = slotMinutes(time);
      if (mins !== null && mins <= now.minutes) available = false;
    }
    return { time, available, remaining: Math.max(0, SLOT_CAPACITY - used) };
  });

  res.json({ success: true, date, capacity: SLOT_CAPACITY, slots });
});

// @desc  Get user's bookings
// @route GET /api/services/my
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await ServiceBooking.find({ user: req.user._id })
    .populate('mechanic', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, bookings });
});

// @desc  Get single booking
// @route GET /api/services/:id
const getBooking = asyncHandler(async (req, res) => {
  const booking = await ServiceBooking.findById(req.params.id)
    .populate('user', 'name phone email')
    .populate('mechanic', 'name phone');
  if (!booking) { res.status(404); throw new Error('Booking not found'); }

  // A customer may only read their own booking.
  const isOwner = String(booking.user?._id || booking.user) === String(req.user._id);
  if (!isOwner && !['admin', 'mechanic'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Not authorized to view this booking');
  }
  res.json({ success: true, booking });
});

// @desc  Update booking status (admin/mechanic)
// @route PUT /api/services/:id/status
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, note, mechanic, estimatedCost, finalCost } = req.body;
  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }

  const mechanicProvided = Object.prototype.hasOwnProperty.call(req.body, 'mechanic');
  const previousMechanic = booking.mechanic ? String(booking.mechanic) : null;

  if (mechanicProvided) {
    booking.mechanic = mechanic ? mechanic : null;
  }

  // Auto-promote to "accepted" the moment a mechanic is assigned to a fresh request
  let effectiveStatus = status || booking.status;
  if (mechanicProvided && mechanic && booking.status === 'requested' && (!status || status === 'requested')) {
    effectiveStatus = 'accepted';
  }

  if (effectiveStatus !== booking.status) {
    booking.status = effectiveStatus;
    booking.statusHistory.push({ status: effectiveStatus, note: note || '' });
  } else if (mechanicProvided && previousMechanic !== (mechanic || null)) {
    booking.statusHistory.push({
      status: booking.status,
      note: mechanic ? 'Mechanic assigned' : 'Mechanic unassigned',
    });
  }

  if (estimatedCost) booking.estimatedCost = estimatedCost;
  if (finalCost) booking.finalCost = finalCost;

  await booking.save();
  const populated = await ServiceBooking.findById(booking._id)
    .populate('user', 'name phone email')
    .populate('mechanic', 'name phone email');
  res.json({ success: true, booking: populated });
});

// @desc  All bookings (admin)
// @route GET /api/services
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = status ? { status } : {};
  const total = await ServiceBooking.countDocuments(query);
  const bookings = await ServiceBooking.find(query)
    .populate('user', 'name phone')
    .populate('mechanic', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, bookings });
});

// @desc  Create a Razorpay order for a booking
// @route POST /api/services/:id/payment
const createServicePayment = asyncHandler(async (req, res) => {
  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }

  if (String(booking.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to pay for this booking');
  }
  if (booking.payment?.status === 'paid') {
    res.status(400);
    throw new Error('This booking has already been paid for');
  }

  // Amount always comes from the server-computed total, never the request body.
  const amount = booking.totalAmount || booking.estimatedCost;
  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error('This booking has no payable amount');
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    res.status(500);
    throw new Error('Online payment is not configured. Please contact support.');
  }

  try {
    const order = await createOrder({ amount, receipt: `srv_${booking._id}` });
    booking.payment.razorpayOrderId = order.id;
    await booking.save();
    res.json({ success: true, order, amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('createServicePayment error:', err?.message);
    res.status(500);
    throw new Error(err?.error?.description || 'Could not start payment. Please try again.');
  }
});

// @desc  Verify a service payment
// @route POST /api/services/:id/verify-payment
const verifyServicePayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }
  if (String(booking.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized');
  }
  if (booking.payment?.status === 'paid') {
    // Idempotent: a duplicate verify call is a success, not an error.
    return res.json({ success: true, alreadyPaid: true, booking });
  }

  const isValid = verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!isValid) {
    booking.payment.status = 'failed';
    booking.statusHistory.push({ status: booking.status, note: 'Payment verification failed' });
    await booking.save();
    res.status(400);
    throw new Error('Payment verification failed. If you were charged, contact support.');
  }

  booking.payment.status = 'paid';
  booking.payment.transactionId = razorpay_payment_id;
  booking.payment.razorpayOrderId = razorpay_order_id;
  booking.payment.razorpayPaymentId = razorpay_payment_id;
  booking.payment.razorpaySignature = razorpay_signature;
  booking.payment.advancePaid = booking.totalAmount || 0;
  booking.payment.paidAt = new Date();
  booking.statusHistory.push({ status: booking.status, note: 'Payment received' });
  await booking.save();

  res.json({ success: true, message: 'Payment verified', booking });
});

module.exports = {
  createBooking,
  createServiceBooking,
  getServiceCategories,
  getAvailability,
  getMyBookings,
  getBooking,
  updateBookingStatus,
  getAllBookings,
  createServicePayment,
  verifyServicePayment,
};
