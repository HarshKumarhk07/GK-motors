const mongoose = require('mongoose');

const rentalBookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rentalCar: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalCar', required: true },
    carSnapshot: {
      title: String,
      brand: String,
      model: String,
      year: Number,
      image: String,
      pricePerDay: Number,
      carNumber: String,
      registrationNumber: String,
      rcNumber: String,
      chassisNumber: String,
      engineNumber: String,
    },
    pickupDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    pickupTime: { type: String, default: '10:00' },
    returnTime: { type: String, default: '10:00' },
    rentalUnit: { type: String, enum: ['day', 'hour'], default: 'day' },
    totalDays: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    pricePerDay: { type: Number, default: 0 },
    pricePerHour: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    pickupAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    driverLicense: { type: String },
    contactPhone: { type: String, required: true },
    fullName: { type: String },
    notes: { type: String },
    kyc: {
      aadharNumber: { type: String, trim: true },
      panNumber: { type: String, trim: true, uppercase: true },
      aadharImage: { type: String },
      panImage: { type: String },
      licenseImage: { type: String },
    },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'active', 'completed', 'cancelled'],
      default: 'requested',
    },
    statusHistory: [
      {
        status: String,
        updatedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    payment: {
      method: { type: String, enum: ['online', 'cod'], default: 'online' },
      status: { type: String, enum: ['pending', 'advance_paid', 'paid', 'refunded'], default: 'pending' },
      // 'full'    → pay totalAmount online up-front
      // 'advance' → pay securityDeposit (or quoted advance) online now, rest at drop
      // 'on_drop' → pay everything in cash at drop time
      plan: { type: String, enum: ['full', 'advance', 'on_drop'], default: 'full' },
      advanceAmount: { type: Number, default: 0 },   // amount charged online up-front
      balanceDue: { type: Number, default: 0 },      // amount to be collected at drop
      amountPaid: { type: Number, default: 0 },      // running total successfully paid
      balanceCollectedAt: { type: Date },
      balanceCollectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      balanceMethod: { type: String, enum: ['cash', 'online', 'upi', 'card', ''], default: '' },
      transactionId: String,
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      paidAt: Date,
    },
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      heading: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

rentalBookingSchema.index({ user: 1, status: 1 });
rentalBookingSchema.index({ rentalCar: 1, pickupDate: 1, returnDate: 1 });

module.exports = mongoose.model('RentalBooking', rentalBookingSchema);
