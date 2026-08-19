const mongoose = require('mongoose');

const rentalCarSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    pricePerDay: { type: Number, required: true },
    pricePerHour: { type: Number, default: 0 },
    rentalUnits: {
      type: [String],
      enum: ['day', 'hour'],
      default: ['day'],
    },
    securityDeposit: { type: Number, default: 0 },
    securityDepositRefundable: { type: Boolean, default: true },
    securityDepositCompulsory: { type: Boolean, default: true },
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
    seats: { type: Number, default: 5 },
    doors: { type: Number, default: 4 },
    color: { type: String },
    bodyType: {
      type: String,
      enum: ['hatchback', 'sedan', 'suv', 'muv', 'coupe', 'convertible', 'pickup', 'van', 'other'],
      default: 'sedan',
    },
    registrationNumber: { type: String, trim: true, uppercase: true },
    carNumber: { type: String, trim: true },
    rcNumber: { type: String, trim: true },
    chassisNumber: { type: String, trim: true },
    engineNumber: { type: String, trim: true },
    insuranceValidTill: { type: Date },
    pucValidTill: { type: Date },
    airConditioning: { type: Boolean, default: true },
    gps: { type: Boolean, default: false },
    bluetooth: { type: Boolean, default: false },
    musicSystem: { type: Boolean, default: true },
    powerWindows: { type: Boolean, default: true },
    powerSteering: { type: Boolean, default: true },
    airbags: { type: Number, default: 2 },
    mileage: { type: String },
    description: { type: String },
    images: [{ type: String }],
    features: [{ type: String }],
    location: {
      city: String,
      state: String,
      pincode: String,
      address: String,
    },
    dropLocation: {
      city: String,
      state: String,
      pincode: String,
      address: String,
    },
    status: {
      type: String,
      enum: ['available', 'rented', 'maintenance', 'inactive'],
      default: 'available',
    },
    isFeatured: { type: Boolean, default: false },
    minRentalDays: { type: Number, default: 1 },
    maxRentalDays: { type: Number, default: 30 },
    minRentalHours: { type: Number, default: 1 },
    maxRentalHours: { type: Number, default: 24 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

rentalCarSchema.index({ brand: 1, model: 1, pricePerDay: 1 });
rentalCarSchema.index({ status: 1 });

module.exports = mongoose.model('RentalCar', rentalCarSchema);
