/* ═══════════════════════════════════════════════════════════════════════════
   ONE-OFF ASSET OPTIMISER

   The generated artwork arrives as 2–7 MB PNGs dropped straight into
   client/public. Anything in that folder is copied verbatim into the deploy,
   so left alone they would have shipped as ~25 MB of images on a page whose
   whole point is loading fast on a phone in Rohtak.

   This script does three things:

     1. Resizes each asset to the largest size it is ever displayed at. A
        2752px-wide workshop photo rendered into a 1280px container is paying
        for pixels nobody sees.
     2. Re-encodes to WebP, which is 60–80% smaller than PNG for photographic
        content at visually identical quality. The one exception is the social
        share image: WhatsApp and several link-preview crawlers still do not
        reliably decode WebP, so that one stays JPEG.
     3. Moves the originals out of public/ into design-source/, which is
        gitignored. They are kept — re-encoding from a JPEG later would
        compound artefacts — but they are no longer deployed.

   Re-runnable: if an original has already been moved, its entry is skipped
   rather than failing.

   Usage:  node scripts/optimise-assets.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
import sharp from 'sharp';
import { mkdir, rename, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Lives under client/ because that is where sharp is installed — Node resolves
   a bare import against the SCRIPT's location, not the working directory. */
const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(CLIENT, 'public');
const SOURCE = path.join(CLIENT, 'design-source');

/* `width` is the widest the asset is ever rendered, doubled where it needs to
   stay sharp on a 2x display and halved where it sits behind an overlay. */
const JOBS = [
  // Hero — the SUV. Sits in a ~560px column, so 1200 covers 2x.
  { from: 'car1.png',        to: 'hero/car.webp',            width: 1200, quality: 86 },

  // Workshop. wi3 is the dark navy/cyan one that matches the dark sections.
  { from: 'wi3.png',         to: 'workshop/bay-dark.webp',   width: 1800, quality: 80 },
  // wi1 is the brighter dusk render, for light sections and the About page.
  { from: 'wi1.png',         to: 'workshop/bay-light.webp',  width: 1800, quality: 80 },
  // wi2 is the documentary-looking one — kept as the third option.
  { from: 'wi2.png',         to: 'workshop/bay-real.webp',   width: 1600, quality: 80 },

  // The parts-shelf shot for the shop section.
  { from: 'parts.png',       to: 'shop/parts.webp',          width: 1400, quality: 84 },
  // Insurance section banner.
  { from: 'crash.png',       to: 'insurance/damage.webp',    width: 1400, quality: 82 },

  // Promo cards. Rendered at ~420px wide, so 800 covers 2x.
  { from: 'banner1.png',     to: 'promos/pickup.webp',       width: 800,  quality: 84 },
  { from: 'banner2.png',     to: 'promos/roadside.webp',     width: 800,  quality: 84 },
  { from: 'banner3.png',     to: 'promos/claims.webp',       width: 800,  quality: 84 },

  /* Social share image. Exactly 1200x630 and JPEG, not WebP — link-preview
     crawlers (WhatsApp especially, which matters most here) are inconsistent
     about WebP and a preview that fails to render is worse than a larger file.
     `fit: cover` because the crawler crops to that ratio anyway; better we
     choose the crop than it does. */
  { from: 'og-image (2).png', to: 'og-image.jpg', width: 1200, height: 630, quality: 82, format: 'jpeg' },
];

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function run() {
  await mkdir(SOURCE, { recursive: true });
  let saved = 0;

  for (const job of JOBS) {
    const src = path.join(PUBLIC, job.from);
    const out = path.join(PUBLIC, job.to);

    if (!existsSync(src)) {
      console.log(`skip   ${job.from} (already moved or never added)`);
      continue;
    }

    await mkdir(path.dirname(out), { recursive: true });
    const before = (await stat(src)).size;

    let pipe = sharp(src).resize({
      width: job.width,
      height: job.height,
      fit: job.height ? 'cover' : 'inside',
      withoutEnlargement: true,
    });

    pipe = job.format === 'jpeg'
      ? pipe.jpeg({ quality: job.quality, mozjpeg: true })
      // effort:6 is the slowest/smallest WebP setting. This runs once, so the
      // encode time is irrelevant and the bytes are not.
      : pipe.webp({ quality: job.quality, effort: 6 });

    await pipe.toFile(out);

    const after = (await stat(out)).size;
    saved += before - after;
    const pct = Math.round((1 - after / before) * 100);
    console.log(`ok     ${job.from.padEnd(18)} -> ${job.to.padEnd(28)} ${kb(before)} -> ${kb(after)}  (-${pct}%)`);

    await rename(src, path.join(SOURCE, job.from));
  }

  /* Videos are moved but not transcoded — there is no ffmpeg here. They are
     already ~2.6 MB each, which is acceptable for a lazily-loaded,
     desktop-only background layer. */
  for (const v of ['video1.mp4', 'video2.mp4']) {
    const src = path.join(PUBLIC, v);
    if (!existsSync(src)) continue;
    await mkdir(path.join(PUBLIC, 'hero'), { recursive: true });
    await rename(src, path.join(PUBLIC, 'hero', v));
    console.log(`move   ${v} -> hero/${v}`);
  }

  console.log(`\nTotal saved: ${kb(saved)}`);

  const leftovers = (await readdir(PUBLIC)).filter((f) => /\.(png|jpe?g|mp4)$/i.test(f));
  console.log(`Remaining loose media in public/: ${leftovers.join(', ') || 'none'}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
