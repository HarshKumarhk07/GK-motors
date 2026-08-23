const mongoose = require('mongoose');

const serviceBookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Legacy single-service fields ──────────────────────────────────────
    // Retained so bookings created before the GK Motors service flow keep
    // rendering (and keep saving) in the admin panel. New bookings populate
    // `selectedCar` + `services` instead.
    bikeModel: { type: String },
    bikeBrand: { type: String },
    bikeYear: { type: Number },
    serviceType: { type: String },
    serviceLabel: { type: String },

    // ── GK Motors: the car being serviced ─────────────────────────────────
    // Not schema-required: the booking controller enforces these for new
    // bookings, while pre-existing documents stay valid on save().
    selectedCar: {
      carId: { type: String, default: null },   // null / 'manual' for manual entry
      brand: { type: String },
      model: { type: String },
      year: { type: Number },
      fuelType: {
        type: String,
        enum: ['petrol', 'diesel', 'electric', 'hybrid', 'cng'],
        default: 'petrol',
      },
      transmission: {
        type: String,
        enum: ['manual', 'automatic'],
        default: 'manual',
      },
      image: { type: String, default: null },
      isManualEntry: { type: Boolean, default: false },
    },

    // ── GK Motors: one or more service packages in a single booking ───────
    services: [
      {
        serviceType: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceType' },
        name: String,
        price: Number,
        category: String,
        categoryId: String,
        tier: {
          type: String,
          enum: ['basic', 'standard', 'comprehensive', 'single'],
          default: 'single',
        },
      },
    ],

    problemDescription: { type: String },

    // Legacy flag. Kept in sync with pickupDrop.enabled below so the older
    // admin views keep working; read pickupDrop for anything new.
    isPickupDrop: { type: Boolean, default: false },

    // ── GK Motors: doorstep pickup & drop ─────────────────────────────────
    // Only offered for slots between 09:00 and 17:59 — the 18:00 slot is too
    // late for the driver to complete a round trip, and the controller
    // re-checks this rather than trusting the client.
    pickupDrop: {
      enabled: { type: Boolean, default: false },
      pickupAddress: {
        label: String,
        street: String,
        city: String,
        state: String,
        pincode: String,
        lat: Number,
        lng: Number,
      },
      // Where the car goes back afterwards:
      //   same           — returned to the pickup address
      //   different      — returned to another address the customer gave
      //   service_center — customer collects it from the workshop
      dropType: {
        type: String,
        enum: ['same', 'different', 'service_center'],
        default: 'service_center',
      },
      dropAddress: {
        label: String,
        street: String,
        city: String,
        state: String,
        pincode: String,
        lat: Number,
        lng: Number,
      },
    },
    isOneHourRepair: { type: Boolean, default: false },

    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },

    mechanic: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'requested',
    },
    statusHistory: [
      {
        status: String,
        updatedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],

    // Server-computed sum of `services[].price`. Defaults to 0 so legacy
    // bookings (which have no services array) still validate on save.
    totalAmount: { type: Number, default: 0, min: [0, 'Total cannot be negative'] },
    estimatedCost: { type: Number },
    finalCost: { type: Number },

    payment: {
      // Online only — cash on delivery has been withdrawn across the platform.
      method: { type: String, enum: ['online'], default: 'online' },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      transactionId: String,
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      advancePaid: { type: Number, default: 0 },
      paidAt: Date,
    },

    invoiceUrl: String,
    notes: String,
  },
  { timestamps: true }
);

serviceBookingSchema.index({ user: 1, createdAt: -1 });
serviceBookingSchema.index({ scheduledDate: 1, scheduledTime: 1, status: 1 });

module.exports = mongoose.model('ServiceBooking', serviceBookingSchema);
