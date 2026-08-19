const mongoose = require('mongoose');

const sellRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    kmDriven: { type: Number, required: true },
    variant: { type: String, required: true },
    transmission: { type: String, enum: ['Manual', 'Automatic'], required: true },
    fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'], required: true },
    ownerNumber: { type: String, required: true },
    registrationState: { type: String, required: true },
    seatingCapacity: { type: Number, required: true },
    bodyType: { type: String, required: true },
    color: { type: String, required: true },
    features: {
      airbags: { type: Boolean, default: false },
      abs: { type: Boolean, default: false },
      sunroof: { type: Boolean, default: false },
      touchscreen: { type: Boolean, default: false },
      parkingcamera: { type: Boolean, default: false },
      alloywheels: { type: Boolean, default: false },
    },
    insuranceTill: { type: Date },
    serviceHistory: { type: String, enum: ['available', 'partial', 'not_available'], required: true },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
    },
    engineCC: { type: Number },
    registrationNumber: String,
    description: String,
    images: [{ type: String }],
    videos: [{ type: String }],
    askingPrice: { type: Number },
    estimatedPrice: { type: Number },
    isOneHourSell: { type: Boolean, default: false },
    pickupAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'under_review',
        'approved',
        'rejected',
        'pickup_scheduled',
        'sold',
        'cancelled',
      ],
      default: 'pending',
    },
    statusHistory: [
      {
        status: String,
        updatedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    adminNote: String,
    offeredPrice: { type: Number },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid'],
      default: 'pending',
    },
    paymentTransactionId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SellRequest', sellRequestSchema);
