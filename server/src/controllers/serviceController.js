const asyncHandler = require('express-async-handler');
const ServiceBooking = require('../models/ServiceBooking');
const ServiceType = require('../models/ServiceType');
const ServiceCar = require('../models/ServiceCar');
const {
  createOrder, verifyPayment, verifyWebhookSignature,
  isPaymentConfigured, isWebhookConfigured,
} = require('../services/paymentService');
const {
  sendBookingReceivedEmail, sendBookingConfirmationEmail, sendBookingStatusUpdateEmail,
} = require('../services/emailService');
const { istNow, slotMinutes } = require('../utils/istTime');
const { cleanText, cleanMultiline, cleanPincode, cleanNumber, cleanEnum } = require('../utils/sanitize');

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
];
// How many bookings can share one slot before it is shown as full.
const SLOT_CAPACITY = Number(process.env.SERVICE_SLOT_CAPACITY || 3);

/**
 * How long an unpaid booking keeps holding its slot.
 *
 * The booking row is written before the customer ever reaches the payment
 * sheet, so without a bound every abandoned checkout would occupy one of the
 * SLOT_CAPACITY places on that slot permanently. Fifteen minutes matches the
 * window rentalController already uses for exactly this situation (see
 * STALE_REQUESTED_MS there, "user closed Razorpay / payment failed") — long
 * enough to finish paying, short enough that a customer who walked away frees
 * the slot the same afternoon.
 */
const SLOT_HOLD_MINUTES = Number(process.env.SERVICE_SLOT_HOLD_MINUTES || 15);

/**
 * Which bookings actually occupy a slot on a given day.
 *
 * Shared by getAvailability (what we show the customer) and
 * createServicePayment (what we enforce before taking money), so the two can
 * never disagree about whether a slot is free.
 *
 *   • accepted / in_progress — staff have acknowledged it, so it always
 *     holds, whatever the payment says. Legacy bookings and anything settled
 *     offline live here, and releasing one would double-book a real job.
 *   • requested + paid       — holds.
 *   • requested + pending    — holds only inside the grace window. `null` is
 *     matched alongside 'pending' because it also matches a missing field, as
 *     on bookings written before `payment` existed.
 *   • requested + failed     — never holds. The customer has told us they are
 *     not paying, so the slot goes back on sale immediately.
 */
const slotHolderFilter = (start, end) => {
  const cutoff = new Date(Date.now() - SLOT_HOLD_MINUTES * 60 * 1000);
  return {
    scheduledDate: { $gte: start, $lt: end },
    $or: [
      { status: { $in: ['accepted', 'in_progress'] } },
      { status: 'requested', 'payment.status': 'paid' },
      {
        status: 'requested',
        'payment.status': { $in: ['pending', null] },
        createdAt: { $gte: cutoff },
      },
    ],
  };
};

/** Midnight-to-midnight bounds for the day a booking falls on. */
const dayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

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
const cleanAddress = (a = {}) => ({
  // Same whitelist as before; each field now also has markup stripped and a
  // length ceiling, so a pickup address cannot carry a payload into the
  // confirmation email or the admin table.
  label: cleanText(a.label, { field: 'Label', max: 40 }) || 'Address',
  street: cleanText(a.street, { field: 'Street address', max: 200 }),
  city: cleanText(a.city, { field: 'City', max: 80 }),
  state: cleanText(a.state, { field: 'State', max: 80 }),
  pincode: cleanText(a.pincode, { field: 'Pincode', max: 10 }),
  lat: typeof a.lat === 'number' ? a.lat : undefined,
  lng: typeof a.lng === 'number' ? a.lng : undefined,
});
const MAX_BOOKING_DAYS_AHEAD = 30;

// ── Legacy single-service booking (kept for backward compatibility) ────────
// @desc  Create service booking
// @route POST /api/services
const createBooking = asyncHandler(async (req, res) => {
  /* This used to spread `...req.body` straight into ServiceBooking.create().
     The route is `protect` only -- any signed-in customer -- so the body could
     carry anything the schema accepts, including `payment: { status: 'paid' }`,
     `totalAmount`, or `status: 'completed'`. A customer could mark their own
     booking paid without going anywhere near Razorpay.

     Only the fields this legacy single-service form actually collects are read
     now. Money and state are set here, never taken from the request:
     `payment.status` starts pending exactly as the modern flow does, and is
     only ever moved to paid by verifyServicePayment after a verified
     signature. */
  const booking = await ServiceBooking.create({
    user: req.user._id,

    bikeBrand: cleanText(req.body.bikeBrand, { field: 'Brand', max: 50 }),
    bikeModel: cleanText(req.body.bikeModel, { field: 'Model', max: 50 }),
    bikeYear: cleanNumber(req.body.bikeYear, {
      field: 'Year', min: 1990, max: new Date().getFullYear() + 1,
    }),
    serviceType: cleanText(req.body.serviceType, { field: 'Service', max: 100 }),
    serviceLabel: cleanText(req.body.serviceLabel, { field: 'Service', max: 200 }),
    problemDescription: cleanMultiline(req.body.problemDescription, {
      field: 'Problem description', max: 2000,
    }),

    address: {
      street: cleanText(req.body.address?.street, { field: 'Street address', max: 200 }),
      city: cleanText(req.body.address?.city, { field: 'City', max: 80 }),
      state: cleanText(req.body.address?.state, { field: 'State', max: 80 }),
      pincode: cleanPincode(req.body.address?.pincode, { required: false }),
      lat: cleanNumber(req.body.address?.lat, { field: 'Latitude', min: -90, max: 90 }),
      lng: cleanNumber(req.body.address?.lng, { field: 'Longitude', min: -180, max: 180 }),
    },

    scheduledDate: req.body.scheduledDate,
    scheduledTime: cleanEnum(req.body.scheduledTime, TIME_SLOTS, {
      field: 'Time slot', required: true,
    }),

    payment: { method: 'online', status: 'pending' },
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

  /* The slot must still have room. getAvailability greys out full slots, but
     nothing stopped a stale tab — or a crafted request — from booking one
     anyway, and the payment step now refuses a full slot. Checking here too
     means the customer is told before they fill in the rest of checkout,
     rather than at the payment button. Same helper, so the two agree. */
  {
    const { start, end } = dayBounds(when);
    const held = await ServiceBooking.countDocuments({
      ...slotHolderFilter(start, end),
      scheduledTime,
    });
    if (held >= SLOT_CAPACITY) {
      res.status(409);
      throw new Error('That time slot has just been taken. Please choose another slot.');
    }
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
    // Free text from the customer; the only field on this booking that is.
    problemDescription: cleanMultiline(problemDescription, {
      field: 'Problem description', max: 2000,
    }),
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

  /* ── "Booking received", NOT "booking confirmed" ────────────────────────
     Nothing has been paid at this point: this runs as step 1 of the client's
     handlePay(), before the Razorpay order is even created, so the customer
     has not so much as seen the payment sheet. Sending a confirmation here is
     what let a cancelled or failed payment still produce a "Booking
     confirmed" email.

     The real confirmation is sent from verifyServicePayment (or the webhook),
     and only on the call that actually flips the booking to paid.

     Deliberately not awaited, as before — a mail outage must not cost the
     customer a booking that has already been written. */
  if (req.user.email) {
    sendBookingReceivedEmail(req.user, booking, SERVICE_CENTER_ADDRESS)
      .catch((err) => console.error('[serviceController.bookingReceivedEmail]', err.message));
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
  const { start, end } = dayBounds(day);

  // Only bookings that genuinely hold a slot count against capacity. An
  // abandoned checkout used to sit here as 'requested' for ever and quietly
  // take a place out of circulation — see slotHolderFilter.
  const booked = await ServiceBooking.aggregate([
    { $match: slotHolderFilter(start, end) },
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
  const { status, mechanic, estimatedCost, finalCost } = req.body;
  // Stored on the booking and rendered into the customer's status email.
  const note = cleanMultiline(req.body.note, { field: 'Note', max: 1000 });
  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }

  const oldStatus = booking.status;
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

  const statusChanged = effectiveStatus !== oldStatus;

  if (statusChanged) {
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

  // Trigger email notification to customer if status changed
  if (statusChanged && populated.user?.email) {
    sendBookingStatusUpdateEmail(populated.user, populated, oldStatus, effectiveStatus, note)
      .catch((err) => console.error('[updateBookingStatus.emailNotification]', err.message));
  }

  res.json({ success: true, booking: populated });
});

// @desc  All bookings (admin)
// @route GET /api/services
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const query = status && status !== 'all' ? { status } : {};
  const total = await ServiceBooking.countDocuments(query);
  const bookings = await ServiceBooking.find(query)
    .populate('user', 'name phone email')
    .populate('mechanic', 'name phone email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, bookings });
});

/**
 * Flip a booking from unpaid to paid as one atomic, idempotent step.
 *
 * Written as a conditional update rather than read-modify-save because two
 * callers can now arrive at once: the browser's verify-payment request and
 * Razorpay's webhook. The `'payment.status': { $ne: 'paid' }` guard lets
 * exactly one of them match — the winner gets the updated document back, the
 * loser gets `null`.
 *
 * That `null` is the whole point: it is what guarantees the confirmation
 * email is sent exactly once, no matter how many times verification is
 * retried or how the webhook and the browser interleave.
 *
 * An aggregation-pipeline update is used so `statusHistory` can be appended
 * carrying the booking's own current `status` without reading it first.
 * User-supplied strings go through `$literal` so a value starting with `$`
 * can never be read as a field path.
 */
const markBookingPaid = (bookingId, { paymentId, orderId, signature, note }) =>
  ServiceBooking.findOneAndUpdate(
    { _id: bookingId, 'payment.status': { $ne: 'paid' } },
    [
      {
        $set: {
          'payment.status': 'paid',
          // Each id is only written when we actually have one — a webhook
          // payload could in principle omit it, and $literal: undefined is
          // not a valid pipeline value.
          ...(paymentId
            ? {
                'payment.transactionId': { $literal: paymentId },
                'payment.razorpayPaymentId': { $literal: paymentId },
              }
            : {}),
          ...(orderId ? { 'payment.razorpayOrderId': { $literal: orderId } } : {}),
          ...(signature ? { 'payment.razorpaySignature': { $literal: signature } } : {}),
          'payment.advancePaid': { $ifNull: ['$totalAmount', 0] },
          'payment.paidAt': '$$NOW',
        },
      },
      {
        $set: {
          statusHistory: {
            $concatArrays: [
              { $ifNull: ['$statusHistory', []] },
              [{ status: '$status', note: { $literal: note }, updatedAt: '$$NOW' }],
            ],
          },
        },
      },
    ],
    { new: true }
  );

/**
 * Send the confirmation mail for a booking that has just become paid.
 *
 * `user` is the authenticated user on the verify path and null on the webhook
 * path, where there is no request context — so the recipient is looked up
 * from the booking instead.
 */
const sendConfirmationForPaidBooking = async (booking, user) => {
  let recipient = user;
  if (!recipient?.email) {
    const populated = await ServiceBooking.findById(booking._id).populate('user', 'name email');
    recipient = populated?.user;
  }
  if (!recipient?.email) return;
  await sendBookingConfirmationEmail(recipient, booking, SERVICE_CENTER_ADDRESS);
};

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

  if (!isPaymentConfigured()) {
    res.status(500);
    throw new Error('Online payment is not configured. Please contact support.');
  }

  /* Re-check the slot before taking money.
     An unpaid booking only holds its slot for SLOT_HOLD_MINUTES, so a customer
     returning to a pending booking — from My Bookings, or after a failed
     attempt — may find it has since been taken. Checking here rather than only
     at booking time is what stops a retry from overbooking the workshop.
     This booking's own hold is excluded from the count. */
  if (booking.scheduledDate && booking.scheduledTime) {
    const { start, end } = dayBounds(booking.scheduledDate);
    const held = await ServiceBooking.countDocuments({
      ...slotHolderFilter(start, end),
      scheduledTime: booking.scheduledTime,
      _id: { $ne: booking._id },
    });
    if (held >= SLOT_CAPACITY) {
      res.status(409);
      throw new Error(
        'That time slot has just been taken. Please start a new booking and choose another slot.'
      );
    }
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
    // Idempotent: a duplicate verify call is a success, not an error — and it
    // must not send a second confirmation email.
    return res.json({ success: true, alreadyPaid: true, booking });
  }

  // A missing key is a server misconfiguration, not a bad signature. Say so,
  // rather than recording the customer's payment as failed.
  if (!isPaymentConfigured()) {
    res.status(503);
    throw new Error('Online payment is not configured. Please contact support.');
  }

  const isValid = verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!isValid) {
    booking.payment.status = 'failed';
    booking.statusHistory.push({ status: booking.status, note: 'Payment verification failed' });
    await booking.save();
    res.status(400);
    throw new Error('Payment verification failed. If you were charged, contact support.');
  }

  // The signature proves the order/payment pair is ours; this proves the order
  // is *this booking's*. Without it a valid signature from any other order on
  // the account would mark this booking paid.
  if (booking.payment?.razorpayOrderId
      && String(booking.payment.razorpayOrderId) !== String(razorpay_order_id)) {
    res.status(400);
    throw new Error('This payment does not belong to this booking.');
  }

  const paid = await markBookingPaid(booking._id, {
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    signature: razorpay_signature,
    note: 'Payment received and verified',
  });

  if (!paid) {
    // The webhook, or a second tab, won the race and already marked it paid.
    // Still a success for the customer, and the email has already gone out.
    const current = await ServiceBooking.findById(booking._id);
    return res.json({ success: true, alreadyPaid: true, booking: current });
  }

  /* The confirmation email — only here, and only on the call that actually
     performed the pending → paid transition. Deliberately not awaited: the
     payment is already recorded, so a Brevo outage must not turn a successful
     payment into a failed request. */
  sendConfirmationForPaidBooking(paid, req.user)
    .catch((err) => console.error('[serviceController.confirmationEmail]', err.message));

  res.json({ success: true, message: 'Payment verified', booking: paid });
});

// @desc  Record that a payment attempt was cancelled or failed
// @route POST /api/services/:id/payment-failed
// @access Private
const markServicePaymentFailed = asyncHandler(async (req, res) => {
  const { reason, cancelled } = req.body || {};

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }
  if (String(booking.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized');
  }

  // A late "it failed" from the browser must never undo a confirmed payment —
  // the webhook may already have captured it.
  if (booking.payment?.status === 'paid') {
    return res.json({ success: true, alreadyPaid: true, booking });
  }

  const detail = String(reason || '').trim().slice(0, 200);

  if (cancelled) {
    /* Walking away from the Razorpay sheet is not a failed payment. The
       booking stays 'pending' so the customer can pick it straight back up
       from My Bookings; its slot hold expires on the normal schedule. */
    booking.statusHistory.push({
      status: booking.status,
      note: detail ? `Payment cancelled by customer: ${detail}` : 'Payment cancelled by customer',
    });
  } else {
    booking.payment.status = 'failed';
    booking.statusHistory.push({
      status: booking.status,
      note: detail ? `Payment failed: ${detail}` : 'Payment failed',
    });
  }

  await booking.save();
  res.json({ success: true, booking });
});

/**
 * Razorpay webhook — the authoritative record of what happened to a payment.
 *
 * The browser callback can be lost between Razorpay charging the card and our
 * verify endpoint being reached: the tab is closed, the phone locks, the
 * connection drops. That gap is how a customer ends up charged for a booking
 * that still reads "payment pending". Razorpay retries a webhook until it gets
 * a 2xx, so this closes it.
 *
 * Mounted in index.js *ahead of* express.json() so `req.body` is still the raw
 * Buffer the signature was computed over — re-serialising parsed JSON produces
 * different bytes and always fails verification.
 *
 * Answers 200 for events we deliberately ignore: a non-2xx would make Razorpay
 * retry something we have already decided not to act on.
 *
 * Not wrapped in asyncHandler — it is mounted directly on the app, outside the
 * router that carries the shared error handler.
 */
const razorpayWebhook = async (req, res) => {
  try {
    if (!isWebhookConfigured()) {
      // Nothing to verify against, so refuse rather than trust an unsigned body.
      return res.status(503).json({ success: false, message: 'Webhook is not configured' });
    }

    if (!verifyWebhookSignature(req.body, req.headers['x-razorpay-signature'])) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Malformed payload' });
    }

    const entity = event?.payload?.payment?.entity || {};
    const orderId = entity.order_id;
    const paymentId = entity.id;
    if (!orderId) return res.json({ success: true, ignored: 'no order id' });

    const booking = await ServiceBooking.findOne({ 'payment.razorpayOrderId': orderId });
    // Parts orders and rental bookings share this Razorpay account, so an
    // order id we do not recognise here is normal, not an error.
    if (!booking) return res.json({ success: true, ignored: 'not a service booking' });

    if (event.event === 'payment.captured') {
      const paid = await markBookingPaid(booking._id, {
        paymentId,
        orderId,
        note: 'Payment captured (Razorpay webhook)',
      });
      // Only the call that performed the transition sends the mail, so a
      // webhook arriving after the browser already verified stays silent.
      if (paid) {
        sendConfirmationForPaidBooking(paid, null)
          .catch((err) => console.error('[serviceController.webhookEmail]', err.message));
      }
      return res.json({ success: true, handled: event.event, transitioned: Boolean(paid) });
    }

    if (event.event === 'payment.failed') {
      const why = entity.error_description
        ? `: ${String(entity.error_description).slice(0, 200)}`
        : '';
      // Guarded on not-paid: a failed first attempt can arrive after a
      // successful second one, and must not un-pay the booking.
      await ServiceBooking.updateOne(
        { _id: booking._id, 'payment.status': { $ne: 'paid' } },
        {
          $set: { 'payment.status': 'failed' },
          $push: {
            statusHistory: {
              status: booking.status,
              note: `Payment failed (Razorpay webhook)${why}`,
              updatedAt: new Date(),
            },
          },
        }
      );
      return res.json({ success: true, handled: event.event });
    }

    return res.json({ success: true, ignored: event.event });
  } catch (err) {
    console.error('[serviceController.razorpayWebhook]', err.message);
    // A 500 makes Razorpay retry, which is what we want for a transient fault.
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

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
  markServicePaymentFailed,
  razorpayWebhook,
  // Exported for the webhook mount in index.js and for future tests.
  SLOT_HOLD_MINUTES,
};
