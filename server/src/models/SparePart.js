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

/* This collection had no indexes at all, so every storefront query was a full
   scan. Both of the ones below are on the landing page's critical path and
   match a query in partController exactly — equality fields first, then the
   sort key, so Mongo can satisfy the filter and the ordering from the index
   and never sort in memory:

     getFeaturedParts  find({ isFeatured, isActive }).sort({ createdAt: -1 })
     getRecentParts    find({ comingSoon: { $ne: true }, isActive })
                         .sort({ createdAt: -1 }).limit(n)

   No existing index to conflict with, and neither changes stored data —
   Mongoose builds them in the background on connect. */
sparePartSchema.index({ isActive: 1, isFeatured: 1, createdAt: -1 });
sparePartSchema.index({ isActive: 1, comingSoon: 1, createdAt: -1 });

module.exports = mongoose.model('SparePart', sparePartSchema);
