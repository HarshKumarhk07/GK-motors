require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

/**
 * Recover real product photos for the spare-parts store.
 *
 * Background: the catalogue used to live in a different database on the same
 * Atlas cluster (before MONGO_DB_NAME was set, everything landed in "test").
 * Those old part documents hold Cloudinary URLs pointing at photography that is
 * still hosted — the images were never deleted, only the database reference to
 * them was left behind. This walks the other databases on the cluster, finds
 * parts that have real image URLs, matches them to the parts in the current
 * database, and copies the URLs across.
 *
 *   node server/src/seeds/restorePartImages.js              # dry run, changes nothing
 *   node server/src/seeds/restorePartImages.js --apply      # write the matches
 *   node server/src/seeds/restorePartImages.js --from=test  # only look in one database
 *   node server/src/seeds/restorePartImages.js --all        # include weaker matches
 *
 * Dry run is the default on purpose: read the proposed pairings first, then
 * re-run with --apply. Parts that already have an image are never touched.
 */

const APPLY = process.argv.includes('--apply');
const LOOSE = process.argv.includes('--all');
const FROM = (process.argv.find((a) => a.startsWith('--from=')) || '').split('=')[1];

// A path like /uploads/parts/x.png only resolves if that file still exists on
// this server. A hosted URL is the thing actually worth recovering.
const isHosted = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

const STOP = new Set([
  'the', 'and', 'for', 'with', 'set', 'kit', 'pack', 'of', 'car', 'auto',
  'litre', 'liter', 'ltr', 'l', 'ml', 'new', 'genuine', 'original',
]);

const tokens = (s) =>
  new Set(
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t.length > 1 && !STOP.has(t))
  );

const overlap = (a, b) => {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.min(a.size, b.size);
};

const score = (mine, theirs) => {
  if (mine.sku && theirs.sku && mine.sku === theirs.sku) return 1;
  const brandMatch =
    mine.brand && theirs.brand &&
    mine.brand.trim().toLowerCase() === theirs.brand.trim().toLowerCase();
  const nameScore = overlap(tokens(mine.name), tokens(theirs.name));
  return brandMatch ? Math.min(1, nameScore + 0.35) : nameScore;
};

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI is not set in server/.env');
    process.exit(1);
  }
  const currentDb = process.env.MONGO_DB_NAME?.trim() || 'test';

  const conn = await mongoose.connect(uri, { dbName: currentDb });
  const admin = conn.connection.db.admin();
  console.log(`Connected. Current database: ${currentDb}\n`);

  // ── Which databases to search ──────────────────────────────────────────
  let dbNames = [];
  if (FROM) {
    dbNames = [FROM];
  } else {
    try {
      const { databases } = await admin.listDatabases();
      dbNames = databases
        .map((d) => d.name)
        .filter((n) => !['admin', 'local', 'config'].includes(n) && n !== currentDb);
    } catch (err) {
      console.warn(`Could not list databases (${err.message}).`);
      console.warn('Falling back to the usual suspects. Use --from=<name> to name one directly.\n');
      dbNames = ['test', 'autoxpress', 'bikeservice'].filter((n) => n !== currentDb);
    }
  }
  console.log(`Searching: ${dbNames.join(', ') || '(nothing to search)'}\n`);

  // ── Harvest old parts that carry hosted images ─────────────────────────
  const donors = [];
  for (const name of dbNames) {
    let docs = [];
    try {
      docs = await conn.connection.client
        .db(name).collection('spareparts')
        .find({ images: { $exists: true, $ne: [] } })
        .project({ name: 1, brand: 1, sku: 1, images: 1 })
        .toArray();
    } catch {
      continue;                        // no such collection, or no read access
    }
    const usable = docs
      .map((d) => ({ ...d, images: (d.images || []).filter(isHosted) }))
      .filter((d) => d.images.length);
    if (usable.length) {
      console.log(`  ${name}.spareparts → ${usable.length} part(s) with hosted images`);
      usable.forEach((d) => donors.push({ ...d, _db: name }));
    }
  }

  if (!donors.length) {
    console.log('\nNo old parts with hosted image URLs found.');
    console.log('The photos may have been uploaded to Cloudinary but never recorded here,');
    console.log('or the old database has already been dropped. In that case the quickest');
    console.log('route is Admin -> Parts, or send the image files over and they can be');
    console.log('wired into the seed directly.');
    process.exit(0);
  }

  // ── Match against the parts that need a photo ──────────────────────────
  const SparePart = require('../models/SparePart');
  const mine = await SparePart.find({ isActive: true });

  const needs = mine.filter((p) => !(p.images || []).some(isHosted));
  console.log(`\n${mine.length} active part(s) here, ${needs.length} without a hosted photo.\n`);

  const threshold = LOOSE ? 0.34 : 0.55;
  let matched = 0;

  for (const part of needs) {
    let best = null;
    let bestScore = 0;
    for (const donor of donors) {
      const s = score(part, donor);
      if (s > bestScore) { bestScore = s; best = donor; }
    }

    if (!best || bestScore < threshold) {
      console.log(`  —  ${part.name}\n       no match${best ? ` (closest: "${best.name}" at ${(bestScore * 100).toFixed(0)}%)` : ''}`);
      continue;
    }

    matched += 1;
    console.log(`  ${APPLY ? '✓' : '·'}  ${part.name}`);
    console.log(`       ← ${best._db}: "${best.name}" (${(bestScore * 100).toFixed(0)}% match)`);
    console.log(`       ${best.images[0]}`);

    if (APPLY) {
      part.images = best.images;
      await part.save();
    }
  }

  console.log('');
  if (APPLY) {
    console.log(`Updated ${matched} part(s).`);
  } else {
    console.log(`${matched} part(s) would be updated. Nothing has been written.`);
    console.log('Read the pairings above, then re-run with --apply.');
    if (matched < needs.length) {
      console.log('Add --all to consider weaker matches too (check them carefully).');
    }
  }

  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Image recovery failed:', err.message);
  process.exit(1);
});
