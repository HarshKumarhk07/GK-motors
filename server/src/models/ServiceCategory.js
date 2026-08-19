const mongoose = require('mongoose');

/**
 * A service category — the top level of the booking taxonomy.
 *
 * These were hardcoded in three places (Services.jsx, Home.jsx, the admin
 * dashboard) and joined to ServiceType by a magic number. They now live here
 * so the admin can add and remove them, while `categoryId` stays the join key
 * so existing ServiceType and ServiceBooking documents keep resolving.
 *
 * `slug` selects the shipped illustration under client/public/service-icons/.
 * A category with no matching file simply falls back to a generic icon.
 */
const serviceCategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: Number,
      required: true,
      unique: true,
      min: [1, 'Category id must be 1 or greater'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    slug: { type: String, trim: true, lowercase: true, default: '' },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    image: { type: String, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceCategorySchema.index({ isActive: 1, order: 1 });

// Derive a slug from the name when one is not supplied, so the icon lookup
// has something to try.
serviceCategorySchema.pre('validate', function slugify(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/&/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);
