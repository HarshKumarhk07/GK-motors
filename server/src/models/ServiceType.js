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

    // ── Rich package detail (all optional) ──────────────────────────────
    // Every field below is unset on packages created before this existed, and
    // the card hides any section with no data rather than inventing a value.
    // Nothing here participates in pricing — see getServicePrice().

    /** What the package includes, one line each. Order is the display order. */
    features: { type: [String], default: [] },

    /** How long the car is with us. Rendered as "4 Hrs". */
    durationHours: { type: Number, default: null, min: [0, 'Duration cannot be negative'] },

    warranty: {
      months: { type: Number, default: null, min: [0, 'Warranty months cannot be negative'] },
      distanceKm: { type: Number, default: null, min: [0, 'Warranty distance cannot be negative'] },
    },

    /** How often we suggest booking this again. */
    recommendedIntervalKm: { type: Number, default: null, min: [0, 'Interval cannot be negative'] },
    recommendedIntervalMonths: { type: Number, default: null, min: [0, 'Interval cannot be negative'] },

    /** '' hides the row entirely, which is the default for existing packages. */
    pickupDrop: {
      type: String,
      enum: ['', 'free', 'paid', 'unavailable'],
      default: '',
    },

    /** Shows the green RECOMMENDED flag on the card. */
    isRecommended: { type: Boolean, default: false },

    /**
     * Pre-discount price, for the struck-through figure and the savings line.
     * Display only: the amount actually charged still comes from the per-car
     * override or basePrice. Ignored unless it is above the charged price.
     */
    originalPrice: { type: Number, default: null, min: [0, 'Original price cannot be negative'] },

    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

serviceTypeSchema.index({ isActive: 1, categoryId: 1, order: 1 });

module.exports = mongoose.model('ServiceType', serviceTypeSchema);
