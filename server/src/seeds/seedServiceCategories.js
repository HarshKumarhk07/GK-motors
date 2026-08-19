require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceType = require('../models/ServiceType');

/**
 * Move the 12 originally-hardcoded categories into the database so the admin
 * can manage them. `categoryId` matches what seedServicePackages.js already
 * wrote onto every ServiceType, so existing packages attach automatically.
 *
 * Safe to re-run: existing categories are updated, never duplicated, and any
 * name the admin has edited is preserved.
 *
 *   node server/src/seeds/seedServiceCategories.js
 */
const CATEGORIES = [
  { categoryId: 1,  name: 'Car Service',           slug: 'car-service',          description: 'Periodic maintenance & oil change' },
  { categoryId: 2,  name: 'AC Service & Repair',   slug: 'ac-service',           description: 'AC gas refill, cooling check' },
  { categoryId: 3,  name: 'Batteries',             slug: 'batteries',            description: 'Battery replacement & testing' },
  { categoryId: 4,  name: 'Tyre & Wheel Care',     slug: 'tyres-wheel-care',     description: 'Tyre rotation, alignment, balancing' },
  { categoryId: 5,  name: 'Denting & Painting',    slug: 'denting-painting',     description: 'Dent removal & premium painting' },
  { categoryId: 6,  name: 'Detailing Service',     slug: 'detailing-service',    description: 'Interior & exterior deep cleaning' },
  { categoryId: 7,  name: 'Car Spa & Cleaning',    slug: 'car-spa-cleaning',     description: 'Washing, waxing & polishing' },
  { categoryId: 8,  name: 'Car Inspection',        slug: 'car-inspections',      description: 'Comprehensive vehicle checkup' },
  { categoryId: 9,  name: 'Windshield & Light',    slug: 'windshields-lights',   description: 'Glass repair & headlight restoration' },
  { categoryId: 10, name: 'Suspension & Fitments', slug: 'suspension-fitments',  description: 'Suspension repair & accessories' },
  { categoryId: 11, name: 'Clutch & Body Parts',   slug: 'clutch-body-parts',    description: 'Clutch replacement & body repair' },
  { categoryId: 12, name: 'Insurance Claims',      slug: 'insurance-claims',     description: 'Insurance claim assistance' },
];

const seed = async () => {
  await connectDB();

  let created = 0, updated = 0;
  for (const [i, cat] of CATEGORIES.entries()) {
    const existing = await ServiceCategory.findOne({ categoryId: cat.categoryId });
    if (existing) {
      // Keep whatever the admin has renamed or re-illustrated.
      existing.slug = existing.slug || cat.slug;
      if (!existing.description) existing.description = cat.description;
      if (!existing.order) existing.order = i + 1;
      await existing.save();
      updated += 1;
    } else {
      await ServiceCategory.create({ ...cat, order: i + 1 });
      created += 1;
    }
  }

  // Backfill categoryName on packages so the site and bookings read the same label.
  const cats = await ServiceCategory.find();
  for (const c of cats) {
    await ServiceType.updateMany({ categoryId: c.categoryId }, { $set: { categoryName: c.name } });
  }

  const orphans = await ServiceType.countDocuments({
    isActive: true,
    categoryId: { $nin: cats.map((c) => c.categoryId) },
  });

  console.log(`Service categories seeded - ${created} created, ${updated} updated.`);
  if (orphans) {
    console.log(`   ${orphans} active package(s) belong to no category and will not appear on the site.`);
    console.log('   Reassign them under Admin > Services > Categories.');
  }
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });

module.exports = { CATEGORIES };
