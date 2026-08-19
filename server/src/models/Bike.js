const mongoose = require('mongoose');

const bikeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    type: { type: String, enum: ['new', 'used'], default: 'used' },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good',
    },
    price: { type: Number, required: true },
    kmDriven: { type: Number, default: 0 },
    engineCC: { type: Number },
    fuelType: {
      type: String,
      enum: ['petrol', 'electric', 'hybrid'],
      default: 'petrol',
    },
    description: { type: String },
    images: [{ type: String }],
    videos: [{ type: String }],
    features: [{ type: String }],
    location: {
      city: String,
      state: String,
      pincode: String,
    },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['available', 'sold', 'pending', 'inactive'],
      default: 'available',
    },
    isApproved: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    enquiries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isFeatured: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    discountedPrice: { type: Number },
    stock: { type: Number, default: 0 },
    pincodePricing: [{
      pincode: String,
      location: String,
      size: String,
      price: Number,
      originalPrice: Number,
      discount: Number,
      inventory: { type: Number, default: 0 },
    }],
    sellerDetails: {
      name: String,
      phone: String,
      location: String,
      email: String,
    },
    specifications: {
      power: String,
      torque: String,
      transmission: String,
      brakes: String,
      tyres: String,
      weight: String,
      fuelTank: String,
      mileage: String,
    },
  },
  { timestamps: true }
);

bikeSchema.index({ brand: 1, model: 1, price: 1 });
bikeSchema.index({ status: 1, isApproved: 1 });

module.exports = mongoose.model('Bike', bikeSchema);
