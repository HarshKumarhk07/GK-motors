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

const meta = () => mongoose.connection.collection('appmeta');

const readHighWater = async () => {
  const doc = await meta().findOne({ _id: META_KEY });
  return doc?.value ?? 0;
};

const writeHighWater = async (value) => {
  await meta().updateOne(
    { _id: META_KEY },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true }
  );
};

const bootstrapCatalogue = async () => {
  try {
    const highWater = await readHighWater();
    const fresh = CATEGORIES.filter((c) => c.id > highWater);
    if (fresh.length === 0) return { skipped: true };

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
          isActive: true,
          order,
        });
        createdPkgs += 1;
      }
    }

    // The nine original single-service types are superseded by the packages
    // above, so retire them the first time through rather than listing both.
    let retired = 0;
    if (createdPkgs > 0) {
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
    return { createdCats, createdPkgs, retired };
  } catch (err) {
    console.error('Catalogue bootstrap failed (the API is still running) ->', err.message);
    return { error: err.message };
  }
};

/** Forget the high-water mark, so the next boot re-adds anything missing. */
const resetCatalogueBootstrap = async () => {
  await meta().deleteOne({ _id: META_KEY });
};

module.exports = { bootstrapCatalogue, resetCatalogueBootstrap, META_KEY };
