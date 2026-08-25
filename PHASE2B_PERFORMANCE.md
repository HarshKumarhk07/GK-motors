# Phase 2B — Landing Page Performance & Loading

**Date:** 25 August 2026
**Scope:** Scroll performance, initial load, navigation responsiveness. No UI redesign, no Phase 2A logic touched.
**Files changed:** 8 source + 6 image assets. **Phase 2A verified byte-identical.**

---

## 1. BASELINE

### Build status — **FAILS in the available environment**

```
$ npm run build
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

`client/node_modules` was installed on Windows, so it carries `@rollup/rollup-win32-x64-msvc`. The tooling I can reach runs on Linux. As instructed, **no dependency or lockfile changes were made to work around this.** Everything below is measured from the committed `dist/`, from the source, and from the real `node_modules` on your machine.

### Existing `client/dist` (built 24 Aug, before Phase 2A)

| Asset | Size |
|---|---|
| `index-Dwm20SzG.js` | **1,150,567 B (1.10 MB)** |
| `index-CUNjBUk-.css` | 39,741 B |
| `hero-gt3-silver-BHEx4QMP.png` | 196,242 B |

`dist/index.html` contains **exactly one `<script>` tag** — confirming the whole application shipped as a single chunk. Every landing-page visitor downloaded, parsed and compiled all of it.

### Observations that changed the Phase 1 picture

- **Cold start does NOT block server readiness.** `server/src/index.js:31` runs `connectDB().then(...)` with the bootstrap work inside, while `server.listen()` sits at line 166 *outside* that chain. Express begins accepting connections immediately; the boot work runs concurrently and competes for the connection pool, but it does not gate listening. Phase 1 listed this as suspected-blocking — it is not. See §8.
- **`.glass` / `.glass-dark` / `.glass-light` in `index.css` are dead code** — three `backdrop-filter` rules, zero `className` usages anywhere. No runtime cost; left alone as an unrelated cleanup.
- **The hero image was being upscaled.** The source PNG is 554×241 but is rendered at `maxWidth: 680px`.

---

## 2. CHANGES MADE

| File | Problem addressed | Change |
|---|---|---|
| `components/common/Navbar.jsx` | `backdrop-filter: blur(12px)` on a `position: sticky` bar — per-frame GPU re-blur of the full viewport width, for the entire page height | Moved the background to a `.gk-nav` class. Desktop keeps the blur; **≤1023px and `prefers-reduced-motion` get an opaque `rgba(255,255,255,0.97)` and no filter.** Sticky, z-index, height, border unchanged. Also added intrinsic dimensions + `decoding="async"` to the logo. |
| `pages/Home.jsx` | `.gk-shimmer` animating `background-position` on a `background-clip: text` H1 — repainting the heading every frame, forever, on mobile | Mobile freezes the animation and pins `background-position: 0 0`. The gradient heading stays; it stops moving. |
| `pages/Home.jsx` | `.gk-grid-overlay` mask-image on a full-bleed layer forces its own compositing layer | Mobile drops the mask and halves opacity (0.45 → 0.22). Texture kept, extra layer gone. |
| `pages/Home.jsx` | ~30 large blurred box-shadows rasterised while scrolling | Mobile-only (`≤640px`) shadow radii roughly halved with alpha nudged up, on the booking card, Why-Choose, How-It-Works, testimonials and both pill CTAs. **Desktop values untouched.** |
| `pages/Home.jsx` | Hover lifts firing on tap and sticking on touch screens | `@media (hover: none)` neutralises the CTA hover transform/shadow. |
| `pages/Home.jsx` | `categories` recomputed on every render, producing a new array of new objects — so the 12-card grid could never be skipped | `useMemo` on `[serviceCategories, packages]`; `fetchParts` wrapped in `useCallback`. |
| `pages/Home.jsx` | 5 `<img>` with no dimensions, no lazy, no async decode | Hero: `width`/`height`/`decoding` (stays eager — above the fold on desktop). Testimonials: `width`/`height`/`loading="lazy"`/`decoding="async"`. |
| `components/service/ServiceCategoryGrid.jsx` | 12 cards × an 18px-blur shadow, plus full re-render on every Home state change | Mobile shadow reduced; `@media (hover: none)` guard; wrapped in `React.memo`. **No layout, sizing, grid or 4+8 change.** |
| `components/parts/PartCard.jsx` | 5 wishlist buttons each with `backdrop-filter: blur(10px)`; product images decoded synchronously mid-scroll | Blur moved behind `@media (min-width: 1024px)`; images get `loading="lazy"` + `decoding="async"`. |
| `components/common/Footer.jsx` | Below-fold logo loaded eagerly, undimensioned | `width`/`height`/`loading="lazy"`/`decoding="async"`. |
| `App.jsx` | `window.scrollTo(0,0)` inheriting global `scroll-behavior: smooth` → animated scroll through ~6,000px on every route change | Suppressed per-call by setting `scroll-behavior: auto` inline on `<html>` for the duration, then restoring. In-page anchors keep smooth scrolling. |
| `App.jsx` | Hash never honoured — `/#how-it-works` silently landed at the top | `ScrollToTop` now depends on `hash` and calls `scrollIntoView({ behavior: 'smooth' })` when a matching element exists. |
| `App.jsx` | `Layout` created inline per route → Navbar/Footer remounted on every navigation | Converted to a **react-router layout route with `<Outlet />`**. Chrome mounts once. |
| `App.jsx` | Single 1.10 MB bundle; admin dashboard, Leaflet and framer-motion on the landing page's critical path | `React.lazy` + `Suspense` for **14 routes**. Home and Services stay eager. Light white fallback, not the dark `PageLoader`. |
| `server/controllers/partController.js` | `getFeaturedParts` unbounded — returned every featured part, client kept 5 | Optional `limit` (capped at 100), unset by default so `/featured` is unchanged. Home now requests 5. |
| `server/models/SparePart.js` | Zero indexes — both landing-page queries were full collection scans | Two compound indexes matching the confirmed query shapes exactly. |

---

## 3. SCROLL PERFORMANCE

### What was causing the lag

Phase 1 established what it was **not**: zero scroll listeners, zero `IntersectionObserver`, no Framer Motion on the landing page, no parallax, no video. The cost is **paint and compositing**, and it had four sources:

1. **The sticky navbar's `backdrop-filter`** — the dominant one. A blur on a pinned element forces the compositor to re-sample and re-blur everything behind it on *every frame*, unavoidably, because the bar is pinned by design.
2. **`.gk-shimmer`** — an infinite `background-position` animation on a `background-clip: text` heading. Text repaints are expensive and this one never stopped. The existing mobile kill-list covered `.gk-glow-*` and `.gk-car` but not this.
3. **Full-resolution image decodes during scroll** — four testimonial JPEGs up to 736×1104 rendered at 42×42, eager and synchronously decoded. A decode landing mid-scroll stalls the main thread, which is exactly what "freezes for a moment" describes.
4. **~30 large blurred shadows + a masked full-bleed overlay** — steady rasterising cost across the whole page.

### What changed

All four addressed, mobile-scoped so the desktop design is untouched: blur off below 1024px, shimmer frozen below 900px, testimonial files 93% smaller with lazy + async decode, shadow radii halved below 640px, grid mask dropped on mobile. Hover effects neutralised on touch. Home's re-render churn removed so the card tree isn't reconciled while the parts strip settles.

### What remains

- `filter: blur(30px)` on the hero glow div and `drop-shadow` on `.gk-car` — both inside `.gk-hero-img`, which is `display: none` below 900px, so neither costs anything on mobile.
- `.gk-glow-a` / `.gk-glow-b` still *render* on mobile (animation already off). They are large radial gradients; static gradients are cheap to composite.
- The modal `backdrop-filter`s (checkout, pincode, cart, profile) are untouched — they appear over a scroll-locked page, so they never compete with scrolling.

---

## 4. INITIAL LOAD

### What was contributing

A single 1.10 MB JavaScript chunk with no code splitting anywhere in the project. Every first-time visitor to the homepage downloaded, parsed and compiled the entire application, plus 640 KB of oversized images.

### Code splitting

**622.6 KB of route source is now deferred:**

| Route | Source |
|---|---|
| `admin/Dashboard.jsx` | **373.3 KB** |
| `Cart.jsx` | 57.2 KB |
| `MyBookings.jsx` | 32.9 KB |
| `Profile.jsx` | 29.3 KB |
| `PartDetail.jsx` | 28.1 KB |
| 9 more routes | 101.8 KB |

Libraries no longer reachable from the eager graph: **Leaflet** (144.1 KB JS + 14.5 KB CSS, via Cart/Profile) and **framer-motion** (via PartDetail).

`Home` and `Services` stay eager on purpose — they are the whole funnel, and putting either behind a network round trip would trade page-load time for click latency on the most important interaction on the site.

### Images — 640.9 KB → 70.3 KB (**570.6 KB saved, 89%**)

### API

- `GET /store/parts/featured` now bounded. Previously returned every featured part — full documents including `pincodePricing` arrays and image lists — with the client discarding all but 5.
- Two `SparePart` indexes added (the collection had none, so both landing-page queries were full scans).
- **No duplicate fetches found on the landing page.** `AuthContext` calls `/auth/me` once per load when a token exists; `PincodeModal` is mounted globally but its logic is entirely commented out and it returns `null`, so it fires nothing.
- **One consolidation identified but NOT applied:** Home calls both `/services/categories` and `/service-categories`, and the second already returns each category *with* its packages — the first is redundant. They run in parallel via `Promise.all`, so the wall-clock saving is small, and removing it would change which prices appear in the degraded path where `/service-categories` fails. Documented rather than risked. See §8.

---

## 5. NAVIGATION

### What caused the perceived hanging

Three things, all confirmed in code:

1. **`index.css:14` sets `html { scroll-behavior: smooth }`**, and `ScrollToTop` called `window.scrollTo(0, 0)`, which inherits it. Leaving the landing page from near its bottom therefore *animated* the viewport up through roughly six thousand pixels while the next route was mounting. Seconds of looking frozen.
2. **The hash was never honoured.** `ScrollToTop` depended only on `pathname`, so `/#how-it-works` scrolled to the top instead of the section.
3. **Navbar and Footer remounted on every navigation**, because `Layout` was constructed inline inside each route element — re-running effects and rebuilding the sticky bar's compositing layer each time.

### What changed

Route changes now jump instantly: the behaviour is suppressed for that one call by setting `scroll-behavior: auto` inline on `<html>`, scrolling, then restoring. This was chosen over deleting the stylesheet rule so the hero's `View All Services` anchor keeps its smooth scroll, and over `behavior: 'instant'` because older engines reject that value outright.

`ScrollToTop` now depends on `hash` and scrolls to a matching element when one exists. **The "How It Works" nav item was not removed or redesigned** — that is a later phase; this only makes the routing correct.

`Layout` is now a proper layout route with `<Outlet />`, so the chrome mounts once and only the outlet content swaps.

---

## 6. IMAGE OPTIMIZATION

| File | Before | After | Saving | How |
|---|---|---|---|---|
| `testimonials/aman-singh.jpg` | 107.5 KB (736×1104) | **4.4 KB** (128×128) | 96% | centre-cropped to match `object-fit: cover`, resized, q86 progressive |
| `testimonials/suresh-kumar.jpg` | 71.4 KB (736×946) | **4.1 KB** | 94% | same |
| `testimonials/priya-patel.jpg` | 46.7 KB (688×886) | **3.7 KB** | 92% | same |
| `testimonials/rahul-sharma.jpg` | 18.5 KB (472×591) | **3.7 KB** | 80% | same |
| `gkmotorslogo.png` | 205.0 KB (720×341) | **25.1 KB** | 88% | quantised to 256 colours; **same filename, dimensions, format and alpha** |
| `src/assets/hero-gt3-silver` | 191.6 KB PNG | **29.3 KB WebP** | 85% | same 554×241 pixels, `alpha_quality=100`, `exact=True` |
| **Total** | **640.9 KB** | **70.3 KB** | **89%** | |

**Quality verified, not assumed.** The logo measured RMSE 2.05/255 against the original and is indistinguishable side by side at full size — let alone at the 44px it renders at. The hero WebP preserves alpha exactly (alpha-channel RMSE **0.00**); an apparent edge halo in a first comparison turned out to be my comparison sheet discarding the alpha channel, and re-compositing over the real `#0F172A` hero background showed no difference.

**Decisions:**
- The logo stays PNG at 720×341 because it is also the `og:image` and the favicon source — shrinking it would degrade social previews.
- The hero `.png` is left in place as an unreferenced rollback; Vite will not bundle it.
- Testimonials keep `.jpg` filenames — at 128×128 WebP would save under 1 KB, not worth changing paths for.
- The hero stays **eager**: it is above the fold on desktop. It is `display: none` below 900px, so a phone still downloads 29 KB it never shows — a `<picture>` with a `media` source would fix that; not worth the markup churn at 29 KB.

**Not deleted, as instructed:** `hero-car.png` (848 KB), `logo.png` (988 KB), `car.png` (192 KB), `logo.jpg` (210 KB) — ~2.2 MB with **no references anywhere in the repository**. (`logo.png` only appeared to be referenced because it is a substring of `gkmotorslogo.png`.) They cost nothing at runtime since nothing requests them; deleting is a deploy-size cleanup for a later phase, and I have not verified they are absent from database-stored image paths.

---

## 7. TEST RESULTS

| Check | Result |
|---|---|
| `npm run build` | **FAILS** — `Cannot find module @rollup/rollup-linux-x64-gnu`. Windows-installed `node_modules` on a Linux runner. Not worked around. **Please run it on your machine.** |
| `npm run lint` (changed client files) | **9 errors, all 9 pre-existing.** Verified by extracting each file from `git HEAD` and linting the original: Home 5, ServiceCategoryGrid 2, Footer 1, Navbar 1 — identical counts and rules before and after. **Zero introduced.** |
| JSX parse (`@babel/parser`) | 6/6 changed client files **OK** |
| Undefined-reference scope analysis | Clean (only `Map` / `decodeURIComponent`, standard globals missing from my whitelist) |
| `node --check` (changed server files) | 2/2 **OK** |
| **Phase 2A test suites** | **95/95 still passing** — 19 + 27 + 31 + 18 across all four suites |
| Phase 2A integrity | `git diff --stat --ignore-cr-at-eol` on all 9 Phase 2A files: **951 insertions, 60 deletions — byte-identical to end of Phase 2A.** All markers (`markBookingPaid`, `sendBookingReceivedEmail`, `razorpayWebhook`, `checkoutSignature`, `handleCompletePayment`) present. |
| Line endings | CRLF preserved; no whole-file rewrites in the diff |

**Housekeeping:** linting against `git HEAD` required temporary baseline copies. `device_bash` cannot delete files, so they were moved to the existing `_to_delete/` folder: `__baseline_Home.jsx`, `__b.jsx`, `__b_Navbar.jsx`, `__b_Footer.jsx`, `__b_PartCard.jsx`. **`client/src` is verified clean.** Delete that folder at your convenience.

---

## 8. REMAINING PERFORMANCE RISKS

### CONFIRMED (measured or proven from source)

1. **Bundle numbers are estimates until you build.** 622.6 KB of deferred *source* is not the same as 622.6 KB off the *bundle* — minification, tree-shaking and shared-chunk extraction all change it. Run `npm run build` and compare against the 1,150,567 B baseline.
2. **`index.css` is 1,090 lines with ~40 media queries** and ships in full on every page. Not addressed — it is a refactor, not a perf fix.
3. **Dead `.glass*` rules** in `index.css` (three `backdrop-filter` declarations, zero usages). Harmless at runtime.
4. **The redundant `/services/categories` call on Home.** Safe to remove once you accept that a `/service-categories` failure would fall back to hardcoded `fromPrice` values instead of live package prices.
5. **The mobile hero still downloads 29 KB it never displays** (`display: none` below 900px). A `<picture>` with a `media` source fixes it.
6. **`getBestsellerParts` and `searchParts` remain unbounded.** Not on the landing page, so out of scope here.

### SUSPECTED (needs runtime evidence)

7. **Cold start.** Corrected from Phase 1: the boot work does **not** block `server.listen`. What remains true is that `bootstrapCatalogue()` plus three `updateMany` scans in `migrateLegacyPaymentMethods()` run on **every** boot and compete with the first requests for the connection pool. Whether that plus a sleeping host is what caused "stuck, then fine after refresh" **cannot be confirmed from the repository** — it depends on hosting you have not shared.
   **Proposed, deliberately NOT implemented** (§17 asked for exactly this): record a completion flag for `migrateLegacyPaymentMethods` in the existing `appmeta` collection, the same way `bootstrapCatalogue` already tracks its high-water mark. `'cod'` is no longer a valid enum value so nothing can reintroduce it. The caveat that stopped me implementing it: restoring an old database dump alongside a set flag would skip a migration that dump still needs. `bootstrapCatalogue` itself was **not touched** — it is load-bearing and a fresh database must not become an empty website.
8. **`overflow-x: clip` on `html`, `body`, `#root` and `main` simultaneously.** Stacked clip containers can promote extra layers on some mobile WebKit builds. Unproven, and removing it would expose real horizontal overflow currently being hidden.

### REQUIRES REAL DEVICE TESTING

9. **The actual frame-rate improvement.** Every change targets a confirmed cost, but their relative weight on the client's specific phone is unmeasured.
10. **Whether the freezes are gone.** The senior's complaint is behavioural. Source changes address the confirmed causes; only the device can confirm the symptom.
11. **Route-transition feel with lazy loading.** Secondary routes now fetch a chunk on first visit. On a slow connection that is a brief fallback where there was none. Worth watching — if `/parts` or `/cart` feels sluggish, those are the candidates to move back to eager.

### Recommended verification on the client's phone

1. Deploy, then open Chrome DevTools → connect the real device via **Remote Devices** (`chrome://inspect`). An emulated viewport does not reproduce mobile GPU compositing.
2. **Performance** tab → set **CPU: 4× slowdown** and **Network: Fast 4G** → record while scrolling the landing page top to bottom at a natural speed.
3. Read: **Frames** (look for long frames >50 ms), **Main** (long tasks), and the **Rendering** breakdown — compare *Painting* and *Compositing* totals against a pre-deploy recording.
4. Turn on **Rendering → Paint flashing** and scroll. The sticky navbar should no longer repaint continuously, and the H1 should stop flashing.
5. **Rendering → Layer borders** — confirm the navbar is not forcing a full-width blur layer on mobile.
6. **Network** tab, hard reload with cache disabled: confirm no `Dashboard` chunk, no `leaflet`, and that testimonial JPEGs load lazily as you scroll rather than upfront.
7. **Lighthouse** mobile run before and after, comparing **TBT**, **LCP** and **CLS**.

---

## 9. FILES CHANGED

**Client source (6)**
`src/App.jsx` · `src/pages/Home.jsx` · `src/components/common/Navbar.jsx` · `src/components/common/Footer.jsx` · `src/components/parts/PartCard.jsx` · `src/components/service/ServiceCategoryGrid.jsx`

**Server source (2)**
`src/controllers/partController.js` · `src/models/SparePart.js`

**Assets (6)**
`public/gkmotorslogo.png` (replaced) · `public/testimonials/{rahul-sharma,priya-patel,aman-singh,suresh-kumar}.jpg` (replaced) · `src/assets/hero-gt3-silver.webp` (new; `.png` retained as rollback)

**Not touched:** `index.css` (the `scroll-behavior` rule is deliberately kept — see §5).

---

## 10. PHASE 2B BOUNDARY CHECK

- **No payment logic changed.** All 9 Phase 2A files are byte-identical; 95/95 assertions pass.
- **No booking logic changed.** Booking flow, checkout modal, car selection, fuel selection and service selection untouched.
- **No service UI redesign.** `ServiceCategoryGrid` changes are a mobile shadow radius, a `@media (hover: none)` guard and `React.memo`. Grid columns, card dimensions, clamps, the equal-height mechanism and the 4+8 ordering are all unchanged.
- **No address flow changed.** `Profile.jsx` and `Cart.jsx` were not edited. Leaflet was isolated by route-level splitting rather than by refactoring the map out of the address UI, precisely because that would have meant touching the address flow.
- **No landing-page sections removed or reordered.** Hero, testimonials and section order are exactly as they were.
- **Navbar "How It Works" left in place** — hash routing was fixed so it works; the item itself is a later phase.
- **No Phase 2C/2D/2E work performed.** No dependencies added, removed or changed; no lockfile edits; no migrations; no database data touched.

**This is not a claim that the landing page is now fast.** It removes the causes the audit confirmed. The senior's complaint is a behavioural one and the final word belongs to a recording on the actual device — see §8.

---

*Phase 2B complete. Phase 2C not started.*
