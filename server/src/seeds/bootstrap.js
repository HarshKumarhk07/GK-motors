const mongoose = require('mongoose');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceType = require('../models/ServiceType');
const { CATEGORIES, LEGACY_VALUES, CATEGORY_SLUGS, CATEGORY_BLURBS, inr } = require('./catalogueData');

/**
 * Bring the service catalogue up to date on server startup.
 *
 * Idempotent and additive: it only creates what is missing and never
 * overwrites a name, price or image an admin has edited. That makes it safe on
 * every boot, which is the point — the catalogue is structural, not sample
 * data, so nothing on the site works without it and there is no reason to make
 * an operator remember a command.
 *
 * Deletions are respected. A category the admin removed is not resurrected:
 * only ids above the high-water mark are ever considered. Without that,
 * deleting a category would bring it back on the next restart.
 *
 * Bookkeeping lives in its own `appmeta` collection rather than a sentinel row
 * inside ServiceType, which would otherwise surface in admin listings that
 * query without an isActive filter.
 *
 * Failure is logged and swallowed — a seeding problem must not stop the API
 * serving traffic.
 */
const META_KEY = 'catalogueHighWater';

/**
 * Bumped whenever catalogueData gains presentation detail that packages
 * created by an earlier version are missing. See backfillPackageDetail().
 */
const DETAIL_KEY = 'catalogueDetailVersion';
const DETAIL_VERSION = 2;

const meta = () => mongoose.connection.collection('appmeta');

const readMeta = async (key) => {
  const doc = await meta().findOne({ _id: key });
  return doc?.value ?? 0;
};

const writeMeta = async (key, value) => {
  await meta().updateOne(
    { _id: key },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true }
  );
};

const readHighWater = () => readMeta(META_KEY);
const writeHighWater = (value) => writeMeta(META_KEY, value);

/** The fields a ServiceType carries beyond its identity and price. */
const detailFrom = (pkg) => ({
  image: pkg.image ?? null,
  features: Array.isArray(pkg.features) ? pkg.features : [],
  durationHours: pkg.durationHours ?? null,
  warranty: {
    months: pkg.warranty?.months ?? null,
    distanceKm: pkg.warranty?.distanceKm ?? null,
  },
  recommendedIntervalKm: pkg.recommendedIntervalKm ?? null,
  recommendedIntervalMonths: pkg.recommendedIntervalMonths ?? null,
  pickupDrop: pkg.pickupDrop ?? '',
  isRecommended: pkg.isRecommended === true,
});

/**
 * Top up packages that predate the detail fields.
 *
 * Runs once per DETAIL_VERSION and only writes a field that is still at its
 * empty default — a missing image, an empty feature list, a null duration. An
 * admin who has set an image, rewritten the features or cleared the
 * recommended flag keeps their version; this only fills blanks. Prices, labels
 * and descriptions are never touched.
 */
const backfillPackageDetail = async () => {
  if (await readMeta(DETAIL_KEY) >= DETAIL_VERSION) return 0;

  let updated = 0;

  for (const cat of CATEGORIES) {
    for (const pkg of cat.packages) {
      const existing = await ServiceType.findOne({ value: pkg.value });
      if (!existing) continue;

      const detail = detailFrom(pkg);
      const $set = {};

      if ((!existing.image || existing.image.endsWith('.svg')) && detail.image) {
        $set.image = detail.image;
      }
      if (!existing.features?.length && detail.features.length) $set.features = detail.features;
      if (existing.durationHours == null && detail.durationHours != null) {
        $set.durationHours = detail.durationHours;
      }
      if (existing.warranty?.months == null && detail.warranty.months != null) {
        $set['warranty.months'] = detail.warranty.months;
      }
      if (existing.warranty?.distanceKm == null && detail.warranty.distanceKm != null) {
        $set['warranty.distanceKm'] = detail.warranty.distanceKm;
      }
      if (existing.recommendedIntervalKm == null && detail.recommendedIntervalKm != null) {
        $set.recommendedIntervalKm = detail.recommendedIntervalKm;
      }
      if (existing.recommendedIntervalMonths == null && detail.recommendedIntervalMonths != null) {
        $set.recommendedIntervalMonths = detail.recommendedIntervalMonths;
      }
      if (!existing.pickupDrop && detail.pickupDrop) $set.pickupDrop = detail.pickupDrop;
      // isRecommended defaults to false, so "unset" and "deliberately off" look
      // identical. Only ever turn it on, and only for packages the catalogue
      // marks — never off, which would undo an admin's choice.
      if (detail.isRecommended && !existing.isRecommended) $set.isRecommended = true;

      if (Object.keys($set).length === 0) continue;
      await ServiceType.updateOne({ _id: existing._id }, { $set });
      updated += 1;
    }
  }

  await writeMeta(DETAIL_KEY, DETAIL_VERSION);
  if (updated) console.log(`Catalogue detail backfilled on ${updated} package(s).`);
  return updated;
};

const bootstrapCatalogue = async () => {
  try {
    const highWater = await readHighWater();
    const fresh = CATEGORIES.filter((c) => c.id > highWater);

    // The detail backfill is independent of the high-water mark: the
    // categories may all exist already and still be missing the newer fields.
    const detailUpdated = await backfillPackageDetail();

    if (fresh.length === 0) return { skipped: detailUpdated === 0, detailUpdated };

    let createdCats = 0;
    let createdPkgs = 0;
    let order = await ServiceType.countDocuments({ categoryId: { $ne: null } });

    for (const cat of fresh) {
      if (!(await ServiceCategory.findOne({ categoryId: cat.id }))) {
        await ServiceCategory.create({
          categoryId: cat.id,
          name: cat.name,
          slug: CATEGORY_SLUGS[cat.id] || '',
          description: CATEGORY_BLURBS[cat.id] || '',
          order: cat.id,
        });
        createdCats += 1;
      }

      for (const pkg of cat.packages) {
        if (await ServiceType.findOne({ value: pkg.value })) continue;
        order += 1;
        await ServiceType.create({
          value: pkg.value,
          label: pkg.label,
          price: inr(pkg.basePrice),
          desc: pkg.desc,
          basePrice: pkg.basePrice,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryType: 'service',
          tier: pkg.tier,
          ...detailFrom(pkg),
          isActive: true,
          order,
        });
        createdPkgs += 1;
      }
    }

    // The original single-service types are superseded by the packages above,
    // so retire them the first time through rather than listing both. Values
    // that are still live packages are already filtered out of LEGACY_VALUES.
    let retired = 0;
    if (createdPkgs > 0 && LEGACY_VALUES.length > 0) {
      const res = await ServiceType.updateMany(
        { value: { $in: LEGACY_VALUES }, isActive: true },
        { $set: { isActive: false } }
      );
      retired = res.modifiedCount ?? res.nModified ?? 0;
    }

    // Keep denormalised names in step for anything created earlier by hand.
    const cats = await ServiceCategory.find().select('categoryId name');
    await Promise.all(cats.map((c) =>
      ServiceType.updateMany(
        { categoryId: c.categoryId, categoryName: { $ne: c.name } },
        { $set: { categoryName: c.name } }
      )
    ));

    await writeHighWater(Math.max(highWater, ...CATEGORIES.map((c) => c.id)));

    if (createdCats || createdPkgs) {
      console.log(
        `Catalogue ready: ${createdCats} categor${createdCats === 1 ? 'y' : 'ies'}, ` +
        `${createdPkgs} package(s) added${retired ? `, ${retired} legacy type(s) retired` : ''}.`
      );
    }
    return { createdCats, createdPkgs, retired, detailUpdated };
  } catch (err) {
    console.error('Catalogue bootstrap failed (the API is still running) ->', err.message);
    return { error: err.message };
  }
};

/**
 * Cash on delivery has been withdrawn, so 'cod' is no longer a member of the
 * payment-method enums. Documents written before that change still carry it,
 * and Mongoose validates on save() — so an admin updating the status of an old
 * order or booking would hit a ValidationError on a field they never touched.
 *
 * This rewrites those stored values once. It is a targeted, idempotent update
 * (nothing matches on the second run) and touches no other field:
 *   Order / ServiceBooking  'cod' -> 'online'        (the only method left)
 *   RentalBooking           'cod' -> 'pay_at_drop'   (the pay-on-drop plan)
 * Payment *status* is deliberately left alone: an unpaid order stays unpaid.
 */
const migrateLegacyPaymentMethods = async () => {
  const plan = [
    ['orders', 'online'],
    ['servicebookings', 'online'],
    ['rentalbookings', 'pay_at_drop'],
  ];
  let migrated = 0;
  for (const [collection, replacement] of plan) {
    try {
      const { modifiedCount } = await mongoose.connection
        .collection(collection)
        .updateMany({ 'payment.method': 'cod' }, { $set: { 'payment.method': replacement } });
      migrated += modifiedCount || 0;
    } catch (err) {
      console.error(`Payment-method migration failed for ${collection} ->`, err.message);
    }
  }
  if (migrated) console.log(`Payment method: ${migrated} legacy 'cod' record(s) migrated.`);
  return migrated;
};

/**
 * Forget the bookkeeping, so the next boot re-adds anything missing and
 * re-runs the detail backfill over every package.
 */
const resetCatalogueBootstrap = async () => {
  await meta().deleteMany({ _id: { $in: [META_KEY, DETAIL_KEY] } });
};

module.exports = {
  bootstrapCatalogue,
  resetCatalogueBootstrap,
  migrateLegacyPaymentMethods,
  META_KEY,
  DETAIL_KEY,
};
