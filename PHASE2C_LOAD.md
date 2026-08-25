# Phase 2C — Initial Load, Bundle & Backend Performance

**Date:** 25 August 2026
**Files changed this phase:** 2 (`client/src/pages/Home.jsx`, `client/src/pages/Services.jsx`)
**Phase 2A verified byte-identical (951/60). Phase 2B intact. 95/95 assertions passing.**

---

## 1. BASELINE

### Build status — **STILL FAILS. Production bundle measurements are UNAVAILABLE.**

```
$ cd client && npm run build
Error: Cannot find module @rollup/rollup-linux-x64-gnu
  [cause]: Error: Cannot find module '@rollup/rollup-linux-x64-gnu'
```

I exhausted the options before accepting this:

| Attempt | Result |
|---|---|
| `npm run build` on your machine's VM | fails — only `rollup-win32-x64-gnu` and `rollup-win32-x64-msvc` are installed |
| `@rollup/wasm-node` fallback | not installed |
| npm registry from your machine's VM | **403 Forbidden** |
| npm registry from the cloud container | **403 Forbidden** |
| any preinstalled bundler (esbuild/rollup/vite/webpack/parcel/swc) | none present in either environment |

Versions: rollup **4.60.1**, vite **5.4.21**. Rollup 4 requires a platform-native binary and has no pure-JS path. **No dependency, lockfile or Rollup configuration was modified to work around this.**

### What I used instead — static import-graph analysis

Rather than assume, I wrote an analyser that parses every module with `@babel/parser`, walks from `src/main.jsx` following **only static imports**, and stops at every `import()` call — because a dynamic import is precisely where Rollup cuts a chunk. This does not measure bundle bytes. It does prove the graph shape that *determines* chunk membership.

### Committed `dist/` (built 24 Aug — **pre-Phase-2B**)

| Asset | Size |
|---|---|
| `index-Dwm20SzG.js` | **1,150,567 B** |
| `index-CUNjBUk-.css` | 39,741 B |
| chunks | **1** (a single `<script>` tag in `dist/index.html`) |

This is the only real bundle measurement available, and it predates both 2B and 2C.

### Initial API requests on the homepage (before this phase)

| Endpoint | Caller | Blocking? | Measured payload |
|---|---|---|---|
| `GET /auth/me` | `AuthContext` (only when a token exists) | no | small |
| `GET /services/categories` | `Home` | no (fallback data renders first) | **9.0 KB** of package JSON |
| `GET /service-categories` | `Home` | no | **18.4 KB** of package JSON + category docs |
| `GET /store/parts/featured?limit=5` | `Home` | no (skeletons) | small since 2B |
| `GET /store/parts/recent?limit=5` | `Home`, only if <5 featured | no | small |

Payload figures are computed from the seeded catalogue (12 categories, 35 packages) in `server/src/seeds/catalogueData.js` — a real measurement of what those endpoints serialise, excluding Mongo `_id`/`__v`/timestamps.

---

## 2. CHANGES MADE

### 2.1 `client/src/pages/Services.jsx` — defer the checkout modal

**Problem.** The graph analysis surfaced something I had not expected: **`CheckoutModal.jsx` (58.5 KB) was the single largest module in the eager graph — larger than `Home.jsx` itself.** Phase 2B correctly kept `Services` eager (it is the destination of every CTA), but `Services` statically imports `CheckoutModal`, so the entire modal, its date/slot logic and its Razorpay integration were downloaded by every first-time visitor to the landing page. `utils/istTime.js` came with it, as its only consumer.

**Change.** `React.lazy` + `Suspense`, and *only* that. The component is still rendered unconditionally, exactly as before — it returns `null` while `open` is false, so mount semantics, the `open` prop transitions and Phase 2A's sessionStorage booking handoff all behave identically. `fallback={null}` matches what it renders when closed, so nothing flickers.

**Impact.** 61.4 KB of source (58.5 + 2.9) leaves the eager graph. On `/services` the chunk fetches in parallel with the page rendering, several interactions before it can be opened.

**Risk.** One edge case: the `/services?checkout=true` deep link sets `showCheckout` on mount, so if the chunk has not arrived there is a brief moment with no modal instead of an immediate one. That path also requires a car and services already in the cart. `CarSelector` and `ServiceSelector` were deliberately **left eager** — they render immediately on step 2 and are exactly the "critical booking code required immediately" the brief protects.

### 2.2 `client/src/pages/Home.jsx` — one categories request instead of two

**Problem.** Home called both `/services/categories` (a flat package list, used *only* to compute each category's cheapest price) and `/service-categories` (the admin taxonomy). The second already returns every category **with its packages attached** — so on the happy path the first was pure duplication: the same package documents fetched twice on the landing page's critical path.

I also found a real fault in the old arrangement. `Promise.all` rejects as a whole and only `/service-categories` carried its own `.catch`, so **a failure of `/services/categories` threw away the successful taxonomy response** and dropped the page all the way back to hardcoded categories.

**Change.** Request the taxonomy; derive prices from its embedded `packages` (Home reads only `categoryId` and `basePrice`, both present). **The degraded path is preserved, not dropped:** if the taxonomy request fails or returns nothing, the flat package endpoint is still called, so live prices still appear against the hardcoded fallback list exactly as before. Two requests then — but only then.

**Impact.** One fewer request; category payload **27.4 KB → 18.4 KB**. The `Promise.all` fault is fixed as a side effect.

**Risk.** Low. The failure path was written explicitly rather than removed. An `AbortController`-style `cancelled` flag prevents setState after unmount.

### 2.3 `client/src/pages/Home.jsx` — defer the shop strip's requests

**Problem.** The parts strip is the fourth section down — roughly two screens below the fold on a phone — yet its request fired in the same burst as everything needed for first paint, competing for connections with content the visitor can actually see.

**Change.** A single `IntersectionObserver` on the section, disconnected the moment it fires, with 600px of `rootMargin` so the fetch still starts well before the strip scrolls into view. Deliberately **not** a scroll listener and **not** one observer per card — Phase 2B's whole point was keeping the scroll path free of per-frame work, and this adds none. `partsLoading` still starts `true`, so the skeletons render exactly as before; only the moment the request leaves changes. Browsers without `IntersectionObserver` fall through to fetching immediately.

**Impact.** 1–2 requests leave the initial burst on mobile.

**Risk.** Low. On a tall desktop viewport the section is already within 600px, so it fires immediately — same behaviour as before. The "Try Again" button still calls `fetchParts` directly.

---

## 3. BUNDLE IMPROVEMENT

**These are two different units and must not be read as one trend.** Only the first row is a bundle measurement.

| | Initial JS | Initial CSS | Chunks | Source in eager graph | Eager modules |
|---|---|---|---|---|---|
| **Before Phase 2B** | **1,150,567 B** (measured, `dist/`) | 39,741 B (measured) | **1** | — | — |
| **After Phase 2B** | *not measurable* | *not measurable* | *≥15 expected* | 275.9 KB | 25 |
| **After Phase 2C** | *not measurable* | *not measurable* | *≥16 expected* | **219.4 KB** | **23** |

**Eager graph: 275.9 KB → 219.4 KB of source across 23 modules (−56.5 KB, −20%).**

### Code splitting verified, not assumed (§3)

The analyser confirms these libraries are **absent from the eager graph** and reachable only through a dynamic import:

`leaflet` · `react-leaflet` · `framer-motion` · `socket.io-client` · `@reduxjs/toolkit` · `react-redux` · `@react-google-maps/api` · `swiper` · `date-fns` · `react-hook-form`

15 dynamic-import chunk boundaries confirmed, including `admin/Dashboard.jsx` (373.3 KB), `Cart.jsx` (57.2), `MyBookings.jsx` (32.9), `Profile.jsx` (29.3), `PartDetail.jsx` (28.1), and now `CheckoutModal.jsx` (58.5).

### npm packages still in the eager graph (§4)

| Package | Why | Needed on Home? | Defer? |
|---|---|---|---|
| `react`, `react-dom` | framework | yes | no |
| `react-router-dom` | routing shell | yes | no |
| `axios` | every API call, via `api/axios.js` | yes | no |
| `lucide-react` | icons across Home/Navbar/Footer | yes | no — ESM, tree-shakes per icon |
| `react-hot-toast` | `<Toaster>` mounted in `App` | yes | no |
| **`react-icons`** | **`Footer.jsx:3` only — 4 social icons** | only those 4 | **see below** |

**`react-icons` is the one open question I could not close.** It is imported in exactly one place in the entire repository — `import { FaFacebook, FaInstagram, FaYoutube, FaTwitter } from 'react-icons/fa'` — and `node_modules/react-icons/fa` is **2.8 MB on disk**. Vite/Rollup *should* tree-shake that ESM barrel down to four small components, but **I cannot verify it without a build**, and if tree-shaking under-performs this is by far the largest remaining item. I did not change it: the alternative is swapping to `lucide-react`'s social icons, which are outline-style where these are solid — a visual change, and this phase forbids UI changes. **Check this first when you run the build.**

---

## 4. API / NETWORK IMPROVEMENTS

| | Before 2C | After 2C |
|---|---|---|
| Requests in the initial burst (logged out) | 3–4 | **1** |
| Requests in the initial burst (logged in) | 4–5 | **2** |
| Category payload | 27.4 KB over 2 requests | **18.4 KB over 1 request** |
| Parts requests | immediate | deferred to ~600px before the strip |

- **Removed:** `/services/categories` on the happy path (consolidated into `/service-categories`; still called on the degraded path).
- **Deferred:** `/store/parts/featured` and its conditional `/store/parts/recent` follow-up.
- **Already limited/indexed in 2B:** `getFeaturedParts` gained an optional `limit` (Home asks for 5), and `SparePart` gained two compound indexes.
- **Not parallelised further:** the remaining requests are already independent and concurrent. `/auth/me` is deliberately *not* coupled to anything (see §5).

### Waterfalls (§7)

The only remaining conditional chain is `featured → recent`, and it is a genuine dependency: `recent` is fetched *only* when fewer than five featured parts come back. It cannot be parallelised without making a request that is usually wasted. Left as is.

### Authentication (§8) — verified, no change needed

`AuthProvider` renders `{children}` unconditionally with no loading gate, so **it never blocks the homepage**. `Home.jsx` contains **zero** `useAuth` calls, and because `children` is a stable element reference created in `App`, React skips that subtree when the provider re-renders. `/auth/me` therefore re-renders only actual context consumers — on Home that is `Navbar` plus the five `PartCard`s. No duplicate call exists on this route. Memoising the context value would help marginally but means touching every auth function, which this phase forbids.

---

## 5. BACKEND PERFORMANCE

### CONFIRMED FROM SOURCE

- **`server.listen()` is not blocked by startup work.** `connectDB().then(...)` at `index.js:31` holds the bootstrap; `server.listen` is at line 166, outside that chain. Express accepts connections immediately.
- **`migrateLegacyPaymentMethods()` runs on every boot** and performs **three `updateMany` operations** on `orders`, `servicebookings` and `rentalbookings`, filtering `{'payment.method': 'cod'}`.
- **None of those three collections has an index on `payment.method`.** `Order` has no indexes at all; `RentalBooking` and `ServiceBooking` have indexes on other fields. So these are **three full collection scans per boot**, matching nothing after the first run.
- **It has no completion marker** — but the mechanism already exists in the same file. `bootstrapCatalogue` uses `readMeta`/`writeMeta` against an `appmeta` collection for `catalogueHighWater` and `catalogueDetailVersion`.
- **`mongoose.connect(uri, dbName ? { dbName } : {})` sets no pool options**, so the driver default `maxPoolSize: 100` applies. The boot work is fully sequential — `await bootstrapCatalogue()` then `await migrateLegacyPaymentMethods()`, and the three `updateMany` run in an awaited `for...of`. **It therefore occupies one connection out of a hundred and cannot saturate the pool.** *This corrects the framing I used in Phase 2B, where I described it as competing for the pool.*
- **`SparePart` indexes match the queries they serve.** `{isActive, isFeatured, createdAt:-1}` and `{isActive, comingSoon, createdAt:-1}` — equality fields first, sort key last, so both filter and ordering come from the index.
- **`getBestsellerParts` and `searchParts` remain unbounded**, but the graph confirms **neither is reachable from Home**. Out of scope, still worth bounding later.

### SUSPECTED

- The three unindexed scans could add meaningful latency to the first requests **on a small Atlas tier with large collections**, where a collection scan is slow and CPU-bound. On a larger tier with small collections it is negligible. Unresolvable without knowing the tier and the row counts.

### REQUIRES PRODUCTION DATA

- Actual duration of `bootstrapCatalogue()` and `migrateLegacyPaymentMethods()` per boot.
- Document counts in `orders`, `servicebookings`, `rentalbookings`.
- Atlas tier and whether it is shared (M0/M2/M5) or dedicated.
- Real query timings — no live database was reachable, so **no MongoDB timing in this report is measured.**

### §13 — migration completion marker: PROPOSED, NOT IMPLEMENTED

The brief asked me to propose rather than implement, and two further reasons made that clearly right: the cold-start hypothesis is still unproven (§6), and §15 forbids modifying startup code for an unproven hypothesis.

The marker would in fact be safe from the old-dump risk, because it lives in `appmeta` **inside the same database as the data it describes** — restoring an old dump brings its own `appmeta` along, so a dump predating the marker would still trigger the migration. The proposed change, using helpers already present in the file:

```js
const PAYMENT_MIGRATION_KEY = 'legacyPaymentMethodMigration';
const PAYMENT_MIGRATION_VERSION = 1;

const migrateLegacyPaymentMethods = async () => {
  if (await readMeta(PAYMENT_MIGRATION_KEY) >= PAYMENT_MIGRATION_VERSION) return 0;
  /* ...existing loop unchanged... */
  await writeMeta(PAYMENT_MIGRATION_KEY, PAYMENT_MIGRATION_VERSION);
  return migrated;
};
```

**`bootstrapCatalogue()` was not touched.** It is load-bearing — a fresh database must never serve an empty catalogue.

---

## 6. COLD START

> **"Did we confirm that backend cold start is causing the client's first-load delay?"**

**No. It is not confirmed, and it cannot be confirmed from this repository.**

I searched for every common deployment descriptor. **The only one that exists is `client/vercel.json`, and it is a frontend SPA rewrite** — it says nothing about the backend. Absent: `Dockerfile`, `docker-compose.yml`, `render.yaml`, `railway.json`/`.toml`, `Procfile`, `app.yaml`, `fly.toml`, `netlify.toml`, root or server `vercel.json`, `serverless.yml`, `.ebextensions`, `.platform`, and any CI at all (`.github` does not exist). `server/package.json` has a plain `node src/index.js` start and **no `engines` field**.

So I will not claim the server is sleeping on a free tier. What I can say from source: startup does not block `listen`, cannot saturate the connection pool, and does perform three unindexed collection scans on every boot.

**To settle it, capture in production:**
1. Time-to-first-byte for `GET /api/health` after ≥30 minutes of inactivity, versus immediately afterwards. A large gap that closes on the second request is the signature of a sleeping host.
2. Server boot logs with timestamps — the gap between process start, `✅ MongoDB Connected`, and `🚀 Server running` gives the DB connection time; `Catalogue ready:` gives the bootstrap duration.
3. Atlas → Metrics: connection count, opcounters and scanned-objects at boot; Atlas → Profiler for slow ops.
4. `db.orders.countDocuments()`, `db.servicebookings.countDocuments()`, `db.rentalbookings.countDocuments()` — these decide whether the three scans matter at all.
5. The hosting platform and plan.

---

## 7. TEST RESULTS

| Check | Result |
|---|---|
| `npm run build` | **FAILS** — `Cannot find module @rollup/rollup-linux-x64-gnu`. Registry 403 in both environments; no bundler available anywhere. Nothing modified to bypass it. **Please run it on your machine.** |
| `npm run lint` — `Services.jsx` | 3 errors → **3 errors.** All `react-hooks/set-state-in-effect` on pre-existing effects (`fetchCatalogue`, both deep-link effects). Verified against `git HEAD`: identical 3. |
| `npm run lint` — `Home.jsx` | 5 errors → **4 errors.** The four `'Icon' is defined but never used` are pre-existing; the `set-state-in-effect` error **disappeared** because the §2.2 rewrite moved those setState calls into async `.then()` callbacks. One pre-existing error incidentally cleared. |
| **Lint errors introduced** | **Zero.** |
| JSX parse (`@babel/parser`) | `Home.jsx`, `Services.jsx` — **OK** |
| Import-graph analysis | 23 eager modules, 15 deferred chunk entries, 10 heavy libraries confirmed deferred |
| **Phase 2A suites** | **95/95 passing** (19 + 27 + 31 + 18) |
| Phase 2A integrity | `git diff --stat --ignore-cr-at-eol` on all 9 files: **951 insertions, 60 deletions — unchanged** |
| Payment / webhook / booking / retry / email tests | all green within the 95 |
| Stray files | `client/src` and `server/src` verified clean |

**A near-miss worth recording:** my first attempt to lint both changed files together returned no output, which reads as a clean pass. The exit code was **124** — GNU `timeout` had killed it. Linting one file at a time produced the real results above. Had I not checked the exit code I would have reported a false pass.

**Housekeeping:** temporary tooling and lint baselines are in the existing `_to_delete/` folder — `graph.cjs`, `__b.jsx`, `__b_Footer.jsx`, `__b_Navbar.jsx`, `__b_PartCard.jsx`, `__b_Services.jsx`, `__baseline_Home.jsx`. None are inside `src`. `device_bash` cannot delete; remove the folder at your convenience.

---

## 8. FILES CHANGED

**This phase — 2 files:**

- `client/src/pages/Home.jsx` — categories consolidation (§2.2), deferred parts fetch (§2.3)
- `client/src/pages/Services.jsx` — lazy `CheckoutModal` (§2.1)

**Not changed, deliberately:** `package.json` (see §9), `partController.js`, `SparePart.js`, `bootstrap.js`, `index.js`, `db.js`, `AuthContext.jsx`, `App.jsx`, `PincodeModal.jsx`, and every Phase 2A file.

---

## 9. REMAINING BOTTLENECKS

### CONFIRMED

1. **No production bundle measurement exists for 2B or 2C.** Everything in §3 beyond the pre-2B row is graph analysis. Run `npm run build` and compare against 1,150,567 B.
2. **`react-icons/fa` (2.8 MB on disk) is in the eager graph for four Footer icons.** Should tree-shake; unverified. Highest-value item to check in the build output.
3. **Five dependencies are confirmed unused** — repository-wide grep finds zero imports of `@reduxjs/toolkit`, `react-redux`, `@react-google-maps/api`, `swiper`, `date-fns` (the only "hits" were inside my own analyser script).
   **I did not remove them, for a concrete reason:** unused dependencies contribute **nothing** to the bundle — Rollup only bundles what is imported — so removal has zero effect on this phase's goal. Meanwhile I cannot regenerate `package-lock.json` (registry 403), and editing `package.json` without the lockfile would leave the two inconsistent, which makes **`npm ci` fail** — the command Vercel and most CI use by default. That is a real deployment break in exchange for no runtime gain. Do it locally where the lockfile can be regenerated:
   ```
   cd client && npm uninstall @reduxjs/toolkit react-redux @react-google-maps/api swiper date-fns
   ```
   (`framer-motion` and `socket.io-client` are genuinely used — do not touch them. `react-hook-form` is used by five pages, all now lazy.)
4. **`PincodeModal` is inert but still mounted and still bundled** (6.9 KB). Its `useEffect` body is entirely commented out, `visible` can never become `true`, and its pincode-availability request can never fire — verified. **I left it mounted:** removing it saves ~2 KB gzipped for a component that costs nothing at runtime, and would silently break the re-enable path its own comments describe. A bad trade.
5. **`/service-categories` over-fetches for Home.** Measured on the seeded catalogue: it serialises 18.4 KB of package JSON where Home consumes 1.2 KB. It is shared with `Services.jsx`, so the safe fix is an additive `?slim=1` projection rather than changing the contract — worth doing if the build shows it mattering, but ~5 KB gzipped.
6. **`getBestsellerParts` and `searchParts` are unbounded.** Not reachable from Home.
7. **`index.css` (39.7 KB built) ships in full on every route.**

### SUSPECTED

8. Three unindexed collection scans per server boot may add first-request latency on a small Atlas tier.
9. `AuthContext`'s provider value is rebuilt every render, re-rendering all consumers when `/auth/me` resolves. On Home that is `Navbar` + 5 `PartCard`s — small, and memoising it means touching auth code this phase forbids.

### REQUIRES REAL PRODUCTION DATA

10. Whether cold start affects first load at all (§6).
11. Real MongoDB query timings — **no live database was reachable; no timing in this report is measured.**
12. Whether the deferred parts fetch and the lazy checkout modal feel right on a real device and connection.

---

## 10. PHASE BOUNDARY CHECK

- **No payment logic changed.** All 9 Phase 2A files byte-identical (951/60); 95/95 assertions pass, covering verification, webhook, booking creation, retry and confirmation email.
- **No booking logic changed.** `CheckoutModal.jsx` was not edited — only *when its code is fetched*. It is still rendered unconditionally with the same `open` prop, so mount semantics and the sessionStorage handoff are unchanged.
- **No car/fuel logic changed.** `CarSelector` untouched and deliberately left eager.
- **No address flow changed.** `Profile.jsx` and `Cart.jsx` not opened this phase.
- **No services UI redesign.** `ServiceCategoryGrid`, `ServiceSelector`, `ServicePackageCard`, `ServiceCart` untouched; the 4+8 layout is as it was.
- **No landing section redesign or reorder.** The only `Home.jsx` markup change is a `ref` on the existing shop `<section>`.
- **No Phase 2B work repeated or reverted.**
- **No Phase 2D/2E work performed.** No dependencies added, removed or changed; no lockfile edit; no migration run; no database data touched.

**This is not a claim that initial load is now fast.** One request instead of three or four on the homepage, and 56.5 KB less source in the eager graph, are real and measured. The bundle itself is unmeasured, cold start is unproven, and no MongoDB timing exists. Those need your machine and your production environment.

---

*Phase 2C complete. Phase 2D not started.*
