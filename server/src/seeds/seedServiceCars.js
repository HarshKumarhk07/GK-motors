require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const ServiceCar = require('../models/ServiceCar');

/**
 * Seed the service-car catalogue with a starter set.
 *
 *   node server/src/seeds/seedServiceCars.js
 *
 * These are the three most-serviced cars on Indian roads, so the booking flow
 * and the home-page "Cars we service" strip have something real to show on a
 * fresh database. Everything else is managed from Admin → Services → Cars.
 *
 * Idempotent: matches on brand + model + year, reactivates a car that was
 * soft-deleted, and never overwrites an image you uploaded in the admin panel.
 *
 * Images are deliberately left empty. Stock photos of a specific model are a
 * licensing and accuracy problem, and the hero renders a branded tile until a
 * real photo exists — upload yours in the admin panel and it takes over.
 */
const CARS = [
  { brand: 'Maruti Suzuki', model: 'Swift',  year: 2022, fuelType: 'petrol', transmission: 'manual' },
  { brand: 'Hyundai',       model: 'Creta',  year: 2023, fuelType: 'diesel', transmission: 'automatic' },
  { brand: 'Honda',         model: 'City',   year: 2023, fuelType: 'petrol', transmission: 'automatic' },
];

const seed = async () => {
  await connectDB();

  let created = 0;
  let restored = 0;
  let skipped = 0;

  for (const spec of CARS) {
    const existing = await ServiceCar.findOne({
      brand: spec.brand,
      model: spec.model,
      year: spec.year,
    });

    if (existing) {
      if (existing.isActive) {
        console.log(`  = ${spec.brand} ${spec.model} ${spec.year} — already there, left alone`);
        skipped += 1;
      } else {
        existing.isActive = true;
        await existing.save();
        console.log(`  ↻ ${spec.brand} ${spec.model} ${spec.year} — reactivated`);
        restored += 1;
      }
      continue;
    }

    await ServiceCar.create({ ...spec, image: null, servicePrices: [], isActive: true });
    console.log(`  + ${spec.brand} ${spec.model} ${spec.year} — added`);
    created += 1;
  }

  const total = await ServiceCar.countDocuments({ isActive: true });

  console.log('');
  console.log(`Added ${created}, reactivated ${restored}, unchanged ${skipped}.`);
  console.log(`${total} active car${total === 1 ? '' : 's'} in the catalogue.`);
  console.log('');
  console.log('Next: Admin → Services → Cars → edit each car and upload a photo.');
  console.log('The home-page hero swaps its placeholder tile for the photo automatically.');

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Service car seed failed:', err.message);
  process.exit(1);
});
