const mongoose = require('mongoose');

/**
 * ServiceCar — a car model the admin has published for the GK Motors service
 * booking flow. Distinct from the `Bike` model (which is the marketplace
 * listing of cars for sale); a ServiceCar is a *template* customers pick so we
 * know what they drive and can price services per model.
 */
const serviceCarSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      minlength: [2, 'Brand must be at least 2 characters'],
      maxlength: [50, 'Brand cannot exceed 50 characters'],
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
      minlength: [1, 'Model must be at least 1 character'],
      maxlength: [50, 'Model cannot exceed 50 characters'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1990, 'Year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
    },
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
    // Per-model price overrides. When a ServiceType is absent here the
    // customer is charged that ServiceType's basePrice.
    servicePrices: [
      {
        serviceType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ServiceType',
          required: true,
        },
        price: {
          type: Number,
          required: [true, 'Price is required'],
          min: [0, 'Price cannot be negative'],
        },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Prevent duplicate brand+model+year. Note: soft-deleted (isActive:false) cars
// still occupy their slot — re-adding the same car reactivates it instead of
// creating a second document (handled in the controller).
serviceCarSchema.index({ brand: 1, model: 1, year: 1 }, { unique: true });
serviceCarSchema.index({ isActive: 1, brand: 1 });

module.exports = mongoose.model('ServiceCar', serviceCarSchema);
