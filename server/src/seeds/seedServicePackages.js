require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const { bootstrapCatalogue, resetCatalogueBootstrap } = require('./bootstrap');

/**
 * Manual catalogue seed.
 *
 * The server already runs this on every boot (see seeds/bootstrap.js), so this
 * exists only for the times you want to force it — after deleting categories
 * you want back, or to check the result without restarting.
 *
 *   node server/src/seeds/seedServicePackages.js           # add anything missing
 *   node server/src/seeds/seedServicePackages.js --force   # also restore deleted categories
 */
const run = async () => {
  await connectDB();
  if (process.argv.includes('--force')) {
    await resetCatalogueBootstrap();
    console.log('High-water mark cleared — previously deleted categories will be restored.');
  }
  const result = await bootstrapCatalogue();
  if (result.skipped) console.log('Catalogue already up to date. Nothing to do.');
  else if (result.error) { console.error(result.error); process.exit(1); }
  process.exit(0);
};

run().catch((err) => { console.error(err); process.exit(1); });
