/* ═══════════════════════════════════════════════════════════════════════════
   GUARD: no backticks inside a CSS template literal

   The style blocks in this codebase are tagged template literals:

       const HOME_STYLES = `
         .gk-card { ... }
       `;

   A backtick anywhere inside one — including inside a /* CSS comment *\/ —
   terminates the string early. The rest of the stylesheet is then parsed as
   JavaScript, and esbuild reports something like:

       ERROR: Expected ";" but found "left"

   ...pointing at a line that is perfectly valid CSS, with no mention of a
   quote character. It cost four failed builds during the redesign before the
   pattern was obvious, because the error never names the real cause.

   This check finds it directly and says so. Run as part of `npm run lint`.

   It is deliberately dumb: find `const NAME_STYLES = \`` (or any all-caps
   const opening a template), scan to the closing backtick-semicolon on its own
   line, and report any backtick in between. Every style block in the project
   follows that shape, and a heuristic that occasionally over-reports on a
   file nobody has written yet is a better trade than one that misses this.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const BT = '`';
const OPEN = /^const [A-Z][A-Z0-9_]* = `\s*$/;
const CLOSE = /^`;\s*$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.jsx?$/.test(entry.name)) yield full;
  }
}

const problems = [];

for await (const file of walk(SRC)) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  let inside = false;

  lines.forEach((line, i) => {
    if (!inside) {
      if (OPEN.test(line)) inside = true;
      return;
    }
    if (CLOSE.test(line)) { inside = false; return; }
    if (line.includes(BT)) {
      problems.push({
        file: path.relative(process.cwd(), file),
        line: i + 1,
        text: line.trim(),
      });
    }
  });
}

if (problems.length) {
  console.error(`\n✗ Backtick inside a CSS template literal (${problems.length}):\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    ${p.text}\n`);
  }
  console.error('  A backtick closes the template early and the CSS after it is');
  console.error('  parsed as JavaScript. Remove it — plain quotes read fine in a');
  console.error('  CSS comment.\n');
  process.exit(1);
}

console.log('✓ No backticks inside CSS template literals');
