const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    brand: { type: String },
    description: { type: String },
    price: { type: Number, default: 0 },
    discountedPrice: { type: Number },
    images: [{ type: String }],
    stock: { type: Number, default: 0 },
    sku: { type: String },
    compatibleBikes: [{ type: String }],
    specifications: { type: Map, of: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    comingSoon: { type: Boolean, default: false },
    itemType: { type: String },
    subCategory: { type: String },
    videoUrl: { type: String },
    farmerDetails: {
      name: String,
      phone: String,
      location: String,
      email: String
    },
    variants: [{
      size: { type: String },
      price: { type: Number },
      originalPrice: { type: Number },
      discount: { type: Number },
      countInStock: { type: Number, default: 0 }
    }],
    pincodePricing: [{
      pincode: { type: String },
      location: { type: String },
      size: { type: String },
      price: { type: Number },
      originalPrice: { type: Number },
      discount: { type: Number },
      inventory: { type: Number, default: 0 }
    }],
    ratings: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SparePart', sparePartSchema);
