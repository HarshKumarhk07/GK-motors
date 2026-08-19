const mongoose = require('mongoose');

/**
 * ServiceType — one bookable service package.
 *
 * Packages are grouped into the 12 GK Motors service categories via
 * `categoryId` (1-12, see seeds/seedServicePackages.js). Within a category,
 * `tier` decides mutual exclusivity: basic / standard / comprehensive replace
 * one another in the cart, while `single` packages can be added alongside
 * anything.
 */
const serviceTypeSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    // Display-only price string kept for backward compatibility with the
    // legacy service booking screen (e.g. "From ₹499").
    price: { type: String, required: true },
    desc: { type: String },

    // ── GK Motors service-booking fields ──
    image: { type: String, default: null },
    basePrice: {
      type: Number,
      default: 0,
      min: [0, 'Base price cannot be negative'],
    },
    categoryType: { type: String, default: 'service' },
    categoryId: { type: Number, default: null },   // 1-12, null = uncategorised
    categoryName: { type: String, default: '' },
    tier: {
      type: String,
      enum: ['basic', 'standard', 'comprehensive', 'single'],
      default: 'single',
    },

    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

serviceTypeSchema.index({ isActive: 1, categoryId: 1, order: 1 });

module.exports = mongoose.model('ServiceType', serviceTypeSchema);
