# GK Motors — Phase 1 Technical Audit (Read-Only)

**Date:** 25 August 2026
**Scope:** Full codebase audit. **No files were modified, no packages installed, no migrations run.**
**Repo root:** `D:\Avani Projects\Car-service-website`

**Confidence key used throughout:**
- **[CONFIRMED]** — proven by reading the source; the code demonstrably does this.
- **[SUSPECTED]** — strongly indicated by the code, but needs a runtime measurement (device profiling, network trace, or production log) to prove.
- **[UNVERIFIABLE]** — cannot be determined from source alone; stated explicitly rather than guessed.

---

## 1. PROJECT ARCHITECTURE

Read from `package.json`, `client/package.json`, `server/package.json`, `client/vite.config.js`, `server/src/index.js`, `server/src/config/db.js`.

| Layer | Technology | Evidence |
|---|---|---|
| Monorepo | npm workspace-style root that forwards scripts to `client/` and `server/` | `package.json` |
| Frontend framework | **React 19.2.4** + **Vite 5.4.21** (SPA, no SSR) | `client/package.json` |
| Routing | **react-router-dom 7.13.2** (`BrowserRouter`) | `client/src/App.jsx` |
| Styling | **Tailwind 3.4.19** + very large amounts of **inline `style={{}}`** + per-component `<style>` blocks + a 1,090-line `index.css` | `client/src/index.css`, all pages |
| State management | **React Context only** — `AuthContext` (useReducer) and `CartContext` (two carts in one provider). **Redux Toolkit and react-redux are installed but never imported.** | `client/src/context/*`, verified by grep |
| HTTP client | axios instance, `timeout: 15000`, JWT from `localStorage` via request interceptor, global 401 → hard redirect to `/login` | `client/src/api/axios.js` |
| Backend framework | **Express 4.19.2**, CommonJS, `express-async-handler` on every controller | `server/src/index.js` |
| Database | **MongoDB via Mongoose 7.6.10** (Atlas) | `server/src/config/db.js` |
| Auth | **JWT** (`jsonwebtoken`) + bcryptjs; email OTP login; token in `localStorage['bikeservice_token']` | `server/src/middleware/auth.js`, `controllers/authController.js` |
| Payment provider | **Razorpay 2.9.6** (server SDK) + `checkout.razorpay.com/v1/checkout.js` injected client-side | `server/src/services/paymentService.js`, `client/src/components/service/CheckoutModal.jsx:76-84` |
| Email provider | **Brevo transactional API (preferred) with nodemailer/SMTP fallback** | `server/src/services/emailService.js:22-43` |
| Image hosting | **Cloudinary** with local-disk fallback (`server/uploads/`) | `server/src/middleware/upload.js`, `config/cloudinary.js` |
| Realtime | **Socket.IO 4.8.3** — used only for rental GPS tracking, `cors.origin: '*'` | `server/src/index.js:96-160` |
| Rate limiting | Hand-rolled in-memory limiter on auth routes only | `server/src/middleware/rateLimit.js` |
| API style | REST, `/api/*`, all responses `{ success: true, ... }` | `server/src/index.js:68-79` |
| Deploy hints | `client/vercel.json` SPA rewrite; production origin `https://autoexpress.avanienterprises.in` in CORS allowlist | `client/vercel.json`, `server/src/index.js:41-47` |

### Dependencies installed but effectively unused (all still shipped in the bundle)
`@reduxjs/toolkit`, `react-redux`, `@react-google-maps/api`, `swiper`, `framer-motion` (only `PartDetail.jsx`), `date-fns`. **[CONFIRMED by grep across `client/src`.]**

### Built bundle (from `client/dist`, built 24 Aug)
```
index-Dwm20SzG.js    1,150,567 bytes   (single chunk — NO code splitting)
index-CUNjBUk-.css      39,741 bytes
hero-gt3-silver.png    196,242 bytes
```
There is **no `React.lazy` / `Suspense` anywhere in the project** — verified by grep. Every route, including the 5,887-line admin dashboard and Leaflet, is in that one chunk.

---

## 2. LANDING PAGE STRUCTURE

**Main file: `client/src/pages/Home.jsx` (791 lines).** Single component, no sub-components except two imports. Mounted at `/` inside `Layout` (`App.jsx:78`), which wraps it in `<Navbar />` and `<Footer />`.

| # | Section | Location in `Home.jsx` | Data source | API calls | Assets | Animation | Listeners | State |
|---|---|---|---|---|---|---|---|---|
| 1 | **Hero** | L356–466 | hardcoded `TRUST_TAGS` (L34) | none | `src/assets/hero-gt3-silver.png` (196 KB) | `.gk-glow-a/b` drift 18s/22s, `.gk-shimmer` text sweep 6.5s, `.gk-car` float 7s (all CSS keyframes) | inline `onMouseEnter/Leave` on 2 CTAs | none |
| 2 | **Booking Steps Bar** | L468–556 | hardcoded JSX (not a data array) | none | none | none | none | none |
| 3 | **Services** | L558–596 | `serviceCategories` state ← API, falls back to `FALLBACK_CATEGORIES` (L19–32) | `GET /api/services/categories` + `GET /api/service-categories` | `/service-icons/<slug>.svg` × 12 | CSS hover lift | none | `packages`, `serviceCategories` |
| 4 | **Shop Car Essentials** | L560–627 | `parts` state ← API | `GET /api/store/parts/featured` then conditionally `GET /api/store/parts/recent` | Cloudinary part images | CSS `gk-shimmer` skeleton | `PartCard` adds a `pincode-updated` window listener **per card** | `parts`, `partsLoading`, `partsError` |
| 5 | **Why Choose GK Motors** | L629–655 | hardcoded `WHY_CHOOSE_US` (L40, 5 items) | none | lucide icons | none | none | none |
| 6 | **How It Works** (`id="how-it-works"`) | L657–681 | hardcoded `HOW_IT_WORKS` (L55, 4 items) | none | lucide icons | none | none | none |
| 7 | **Stats / Trust** | L683–698 | hardcoded `STATS` (L48, 4 items) | none | lucide icons | none | none | none |
| 8 | **Testimonials** | L700–742 | hardcoded `TESTIMONIALS` (L65, 4 items) | none | **4 full-size JPEGs from `/public/testimonials/`** rendered at 42×42 px | none | none | none |
| 9 | **Final CTA banner** | L744–789 | hardcoded | none | none | radial gradient | 4 inline `onMouseEnter/Leave` | none |

**Navbar:** `client/src/components/common/Navbar.jsx` (327 lines). `position: sticky; top: 0` + `backdrop-filter: blur(12px)` (L81). Consumes `useAuth()`, `useCart()`, `useServiceCart()`. Loads `/gkmotorslogo.png` (**210 KB PNG**) at 36–44 px display height. Makes **no API calls of its own**.

**Footer:** `client/src/components/common/Footer.jsx` (144 lines). Static, no API calls.

**Child components used by the landing page:**
- `components/service/ServiceCategoryGrid.jsx` → `components/service/CategoryIcon.jsx`
- `components/parts/PartCard.jsx` (+ `PartCardSkeleton`)

**Expensive calculations on Home:** `categories` (L142–148) is recomputed **on every render** — it maps over `serviceCategories` and, for each, runs `packages.filter(...)` plus `Math.min(...map)`. It is **not** wrapped in `useMemo`. With 12 categories and ~30 packages that is ~360 array passes per render. Small in absolute terms, but it is unmemoised churn on the page's hottest component. **[CONFIRMED]**

---

## 3. MOBILE RESPONSIVENESS FINDINGS

### How responsiveness is currently done
Three different mechanisms coexist, which is the root of most of the inconsistency:

1. **Tailwind utility classes** — used in `Navbar.jsx` and container wrappers (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`).
2. **Per-component `<style>` blocks with `!important` media queries** — `Home.jsx` L154–354, `ServiceCategoryGrid.jsx` L118–222, `ServiceSelector.jsx`, `Navbar.jsx` L30–45, `Services.jsx` L157–166.
3. **`client/src/index.css`** — 1,090 lines with ~40 separate `@media` blocks, many with `!important` global typography overrides.

Plus a **`useResponsive()` JS hook** in `client/src/utils/responsive.js` that reads `window.innerWidth` — but grep shows **only `useScrollLock` is actually consumed** (by `Navbar.jsx:62`). `useResponsive` and `useDebounce` are dead code.

### Breakpoints in use — inconsistent
| Breakpoint | Where | Purpose |
|---|---|---|
| 375 px | `ServiceCategoryGrid.jsx:130`, `index.css` | 1-column service cards |
| 380 px | `Navbar.jsx:41` | tighten nav row |
| 480 px | `index.css` (×6) | product grid, typography |
| 560 / 640 px | `ServiceSelector.jsx`, `Home.jsx:327`, `index.css` (×10) | card grids → 2 col |
| 720 / 768 px | `ServiceSelector.jsx`, `Home.jsx:291`, `index.css` (×15) | hero stacking, admin |
| 900 px | `Home.jsx:230,285`, `Services.jsx:158`, `ServiceSelector.jsx` | hero image hidden, cart sidebar stacks |
| 1024 px | Tailwind `lg:` in Navbar | desktop nav ↔ hamburger |
| 1180 px | `Navbar.jsx:36` | nav link density |

**Eight distinct breakpoints across three systems.** `utils/responsive.js` declares a canonical set (375 / 768 / 1024) that the CSS does not follow. **[CONFIRMED]**

### Is the desktop layout simply being compressed?
**Mostly no — but selectively.** Genuine mobile-specific layouts exist:
- Hero: `.gk-hero-img { display: none }` below 900 px — the car image is dropped, grid collapses to one column (`Home.jsx:285-289`). Good.
- Services grid: 2 → 2 → 4 columns at 0/768/1024, 1 column below 375 px (`ServiceCategoryGrid.jsx:120-131`). Good.
- Service package cards: full stack below 560 px with full-width CTA (`ServiceSelector.jsx`). Good.
- Booking cart sidebar: `width: 100%` and `flex-direction: column` below 900 px (`Services.jsx:158-161`). Good.

**Where it *is* compression:**
- **Why Choose Us / How It Works / Stats / Testimonials** all use `repeat(auto-fit, minmax(210px, 1fr))` on desktop, then are forced to `repeat(2, minmax(0,1fr))` at ≤640 px with padding shrunk to `1rem 0.85rem` (`Home.jsx:326-352`). Five "Why Choose Us" cards in a 2-column grid leaves an **orphan card on the last row**. **[CONFIRMED]**
- **Testimonials at 2 columns on a 360 px phone** gives each card roughly 160 px of content width, holding a 42 px avatar + name + role + 5 stars in a flex row, plus an italic quote at `0.78rem`. This is the reviews section that reads as cramped in the screenshots. **[CONFIRMED — this is compression, not a mobile layout.]**
- **`CheckoutModal`** has **zero media queries**. It is a `maxWidth: 620px` centred card with `padding: 1.5rem` throughout and a 4-item horizontal stepper. On a 360 px screen the stepper's four `label` spans at `0.75rem` + 28 px circles in `flex: 1` tracks will overflow or truncate. **[CONFIRMED — no responsive handling exists in this file.]**
- **`CarSelector`** car grid is `repeat(auto-fill, minmax(140px, 1fr))` with no mobile override — on a 360 px viewport that yields 2 columns of ~160 px with an 80 px-tall image; workable but never tuned.

### Overflow / fixed-dimension risks
- **Overflow is suppressed rather than prevented.** `html`, `body`, `#root`, `main` all carry `overflow-x: clip; max-width: 100% !important; width: 100% !important` (`index.css:13-51`) plus `App.jsx` repeats `maxWidth: '100%'` inline on the `Layout` div and `<main>`. This *hides* horizontal overflow instead of fixing the element causing it — so a too-wide child is invisible but still costs layout work. **[CONFIRMED]**
- **Fixed widths that survive to mobile:** `ServiceSelector.jsx` `.gk-pkg-media { flex: 0 0 200px; width: 200px }` — overridden at 900 px and 560 px, so this one is handled. `Services.jsx:236` `width: '300px'` on the cart sidebar — overridden at 900 px. `CheckoutModal` `maxWidth: 620px` — never overridden, but `width: 100%` saves it.
- **The `.gk-glow` blobs** were already fixed once: the code comment at `Home.jsx:168-172` records that a fixed 720 px circle "pushed the document 202px wider than a 320px phone". They now use `min(720px, 100%)`. Historical evidence that this class of bug has bitten before.

### Images and layout shift
**No `<img>` on the landing page carries `width`/`height` attributes or `loading="lazy"`.** Verified by grep — `loading="lazy"` appears in only 4 files, none of them on the landing page.
- Hero car: 196 KB PNG, no dimensions → reserves no space → **CLS on first paint**.
- Navbar logo: 210 KB PNG at 36–44 px → **CLS in the sticky header**.
- 4 testimonial JPEGs (110 KB + 73 KB + 48 KB + 19 KB = **250 KB**) rendered at 42×42 px, eagerly loaded, no dimensions.
**[CONFIRMED]**

### Excessive vertical spacing
Section paddings on `Home.jsx`: hero `4.5rem 0 5.5rem` + `minHeight: 85vh`; services `4rem 0 4.5rem`; shop `4rem 0`; why-choose `4rem 0`; how-it-works `4.5rem 0`; stats `3rem 0`; testimonials `4.5rem 0`; final CTA `4rem 0`. **Only the hero has a mobile override** (`Home.jsx:291-295` reduces it to `2.5rem 0 3rem`). The other seven sections keep desktop padding on a phone — roughly **~450 px of pure vertical padding** below the fold on mobile. **[CONFIRMED]**

---

## 4. SERVICES SECTION FINDINGS

### Where it lives
- **Component:** `client/src/components/service/ServiceCategoryGrid.jsx` (220 lines) — used by **both** `Home.jsx:592` (as `<Link>`s) and `Services.jsx:211` (as `<button>`s via `onSelect`).
- **Icon resolver:** `client/src/components/service/CategoryIcon.jsx` — tries admin upload → `/service-icons/<slug>.svg` → lucide icon.
- **Data:** `GET /api/service-categories` → `serviceCategoryController.getServiceCategories` → `ServiceCategory` collection (+ `ServiceType` packages grouped by `categoryId`).
- **Fallbacks:** `Home.jsx:19-32` `FALLBACK_CATEGORIES` and `Services.jsx:27-41` `FALLBACK_CATEGORIES` — **two separate hardcoded copies of the same 12 categories** that have already drifted (Home orders Insurance Claims 6th; Services orders it 12th).

### How many services exist
**12 categories**, `categoryId` 1–12, matching the reference design exactly:
1 Car Service · 2 AC Service & Repair · 3 Batteries · 4 Tyre & Wheel Care · 5 Denting & Painting · 6 Detailing Service · 7 Car Spa & Cleaning · 8 Car Inspection · 9 Windshield & Light · 10 Suspension & Fitments · 11 Clutch & Body Parts · 12 Insurance Claims

Each category contains N bookable **packages** (`ServiceType` documents, tiered `basic`/`standard`/`comprehensive`/`single`), seeded on every server boot by `server/src/seeds/bootstrap.js`.

### Do all services use the same card?
**Yes — deliberately, and it is documented as intentional.** `ServiceCategoryGrid.jsx:5-27` states in a header comment:

> "Every category renders through ONE card component with ONE set of styles — **there is deliberately no 'featured' variant.** A card's size must not depend on which category it is…"

The layout is enforced by three rules: `grid-auto-rows: 1fr`, `height: 100%` + flex column, `margin-top: auto` on the footer. Title clamped to 2 lines with `min-height: 2.56em`; description clamped to 2 lines with `min-height: 2.4em`.

### Grid across breakpoints (`ServiceCategoryGrid.jsx:120-131`)
| Viewport | Columns |
|---|---|
| < 375 px | 1 |
| 375–767 px | 2 |
| 768–1023 px | 2 |
| ≥ 1024 px | 4 |

### Is there featured/primary support? Is there ordering logic?
- **Featured/large-card support: NO.** Confirmed absent by design (see quote above).
- **Ordering logic: YES, and it already picks the right four.** `ServiceCategoryGrid.jsx:35` exports:
  ```js
  export const LEAD_CATEGORY_IDS = [1, 2, 5, 7];
  ```
  → **Car Service, AC Service & Repair, Denting & Painting, Car Spa & Cleaning** — exactly the four the target design wants prominent. `orderCategories()` (L38-46) does a stable sort putting these first, everything else in catalogue order behind them.

### Verdict on the target structure (4 large in a 2×2 + 8 compact)
**The data model needs NO changes.** `ServiceCategory` already has `categoryId`, `order`, `slug`, `image`, `isActive`. The lead-four ordering already exists and already resolves to the right categories.

**What must change is purely presentational, in one file:**
- `ServiceCategoryGrid.jsx` needs a second card variant (or a `variant` prop) and a split render: `ordered.slice(0,4)` into a `repeat(2, 1fr)` large-card grid, `ordered.slice(4)` into a compact grid.
- Both call sites (`Home.jsx:592`, `Services.jsx:211`) pass the same props, so both pick the change up automatically.
- **Risk:** the "identical height" invariant documented at L5-27 is load-bearing. A new variant must not reintroduce ragged card heights in the compact grid.

**Optional data change:** if the four leads should be admin-configurable rather than hardcoded, add a boolean (e.g. `isFeatured`) to `ServiceCategory` and read it in `orderCategories`. Not required for Phase 2.

---

## 5. BOOKING FLOW — CURRENT FLOW

### The actual flow, traced end to end

```
/services  (client/src/pages/Services.jsx)
│
├─ STEP 1  Category grid  ......................  ServiceCategoryGrid
│          openCategory() → setStep(2), ?category=<id>
│
├─ STEP 2a CAR SELECTION  ......................  CarSelector.jsx
│          GET /api/service-cars  → catalogue cars
│          OR manual entry form (brand/model/year/fuel/transmission)
│          onSelect → setCar() → CartContext (localStorage 'gkmotors_service_cart')
│
├─ STEP 2b SERVICE PACKAGES  ...................  ServiceSelector.jsx
│          packagesByCategory.get(selectedCategory.id)
│          price = per-car override ?? pkg.basePrice   (getServicePrice)
│          addService() → CartContext
│
├─ SIDEBAR  ServiceCart.jsx  →  "Proceed to Checkout"
│
└─ CheckoutModal.jsx  (4 steps, all client-side state)
   ├─ Step 1  Date + Time slot     GET /api/services/availability?date=
   ├─ Step 2  Pickup / Drop        (geolocation + Nominatim reverse geocode)
   ├─ Step 3  Address              GET /api/auth/me  ·  POST /api/auth/address
   └─ Step 4  Payment  →  handlePay()
              1. POST /api/services/book        ← BOOKING CREATED (status 'requested',
                                                   payment.status 'pending')
                                                ← ★ CONFIRMATION EMAIL SENT HERE ★
              2. POST /api/services/:id/payment ← Razorpay order created
              3. window.Razorpay(...).open()    ← customer pays / cancels / fails
              4. POST /api/services/:id/verify-payment  ← signature verified,
                                                          payment.status → 'paid'
```

### Where the expected order and the actual order diverge

| Expected | Actual |
|---|---|
| Car | ✅ `CarSelector` (step 2a) |
| **Fuel Type** | ⚠️ Only for **manually entered** cars. A catalogue car's `fuelType` is fixed in the DB and **cannot be chosen or changed by the customer**. There is no fuel-type step. |
| Service | ✅ `ServiceSelector` (step 2b) — but note the real order is **Category → Car → Package**, not Car → Service |
| Date/Time | ✅ CheckoutModal step 1 |
| Pickup/Address | ✅ CheckoutModal steps 2 + 3 |
| Payment | ✅ CheckoutModal step 4 |
| Payment Verification | ✅ `POST /:id/verify-payment` |
| Booking Confirmation | ⚠️ Booking is created **before** payment; verification only flips `payment.status`. `booking.status` stays `'requested'` forever. |
| Confirmation Email | ❌ **Sent at booking creation, before any payment attempt.** See §8. |

### Backend pieces
| Concern | File / function |
|---|---|
| Booking creation | `server/src/controllers/serviceController.js:82` `createServiceBooking` |
| Legacy single-service booking | `serviceController.js:69` `createBooking` (`POST /api/services`) — still routed, still live |
| Availability | `serviceController.js:326` `getAvailability` |
| Payment order | `serviceController.js:463` `createServicePayment` |
| Payment verification | `serviceController.js:502` `verifyServicePayment` |
| Razorpay wrapper | `server/src/services/paymentService.js` |
| Email | `server/src/services/emailService.js:323` `sendBookingConfirmationEmail` |
| Model | `server/src/models/ServiceBooking.js` |
| Routes | `server/src/routes/serviceRoutes.js` |

### Things the backend does well (do not break these)
- **Prices are resolved server-side and the client's total is never trusted** (`serviceController.js:130-172`). A mismatch >₹1 is rejected with a "prices have changed" error rather than silently corrected.
- **Pickup/drop window is re-validated server-side in IST** (`serviceController.js:40-52`) — not trusted from the client.
- **Catalogue car existence and `isActive` re-checked at booking time** (L100-106).
- **Duplicate services rejected**, all `serviceType` ids verified active (L114-128).
- **Address is whitelisted** via `cleanAddress()` (L55-63) — arbitrary client fields cannot be stored.

### Slot capacity bug found while tracing **[CONFIRMED]**
`getAvailability` (L340-348) counts bookings with `status: { $in: ['requested','accepted','in_progress'] }` — it does **not** filter on `payment.status`. Because a booking is created *before* payment, **every abandoned/failed checkout permanently consumes one of the 3 slots for that time** (`SLOT_CAPACITY = 3`, L14). Nothing ever expires or cleans these up. A handful of abandoned checkouts will show a day as fully booked.

---

## 6. CAR SELECTION FINDINGS

### Model — `server/src/models/ServiceCar.js`
```
brand (req, 2–50) · model (req, 1–50) · year (req, 1990..now+1)
fuelType  enum ['petrol','diesel','electric','hybrid','cng']  default 'petrol'
transmission enum ['manual','automatic'] default 'manual'
image · servicePrices[{ serviceType → ServiceType, price }] · isActive
indexes: {brand,model,year} unique · {isActive, brand}
```
Booking-side mirror in `ServiceBooking.selectedCar` (`ServiceBooking.js:20-37`) with the **same** fuel enum.

### Fuel types — required Petrol / Diesel / CNG
**All three are already supported [CONFIRMED]**, in three places that agree:
- `models/ServiceCar.js:34` — `['petrol','diesel','electric','hybrid','cng']`
- `models/ServiceBooking.js:27` — same enum
- `components/service/CarSelector.jsx:8-14` — `FUEL_TYPES` array, same five, with labels

**Gap:** the list contains **two extra** values (`electric`, `hybrid`). If the target is strictly Petrol/Diesel/CNG, that is a **narrowing** of an enum — and narrowing a Mongoose enum will make any *existing* booking or car with `electric`/`hybrid` fail validation on the next `save()`. See §18.

**Larger gap:** fuel type is only selectable in the **manual entry form** (`CarSelector.jsx:333-338`). Picking a catalogue car (`chooseCatalogueCar`, L83-95) copies `car.fuelType` straight from the DB with no way for the customer to change it. There is **no Car → Fuel Type step** in the flow.

### UI / API surface
| Function | Frontend | API | Controller |
|---|---|---|---|
| List cars | `CarSelector.jsx` `fetchCars` | `GET /api/service-cars` | `serviceCarController.getServiceCars` |
| Single car | — | `GET /api/service-cars/:id` | `getServiceCar` |
| Add / edit / delete car | **Admin only** (`pages/admin/Dashboard.jsx`) | `POST/PUT/DELETE /api/service-cars` | `createServiceCar` etc. |
| Customer "add my car" | Manual entry form, `CarSelector.jsx:266-343` | **none — not persisted anywhere** | — |

**A customer has no vehicle garage.** A manually entered car exists only inside the localStorage service cart and is copied onto the booking (`carId: 'manual'`, `isManualEntry: true`). There is no `User.vehicles` array, no "my cars" screen. **[CONFIRMED]**

### The "editing the car makes the page jump" issue — root cause found

**Chain of events, all in `client/src/pages/Services.jsx`:**

1. Customer clicks the pencil icon in the cart sidebar → `ServiceCart.jsx:56` `onChangeCar`.
2. `Services.jsx:239` runs `() => { setChangingCar(true); setStep(2); }`.
3. `Services.jsx:234` — the sidebar is rendered conditionally: `{car && !changingCar && (<div className="gk-svc-cart">…</div>)}`. Setting `changingCar = true` **unmounts the entire sidebar**.
4. `Services.jsx:152` — `const needsCar = !car || changingCar` becomes true, so `<ServiceSelector>` is **replaced by `<CarSelector>`** (L227-229). React swaps sibling element types, so `CarSelector` **mounts fresh**.
5. `CarSelector.jsx:79` `useEffect(fetchCars, [])` fires → `setLoading(true)` → **`CarSelector.jsx:135` returns `<LoadingSpinner>` and nothing else** while `GET /api/service-cars` is in flight.

**Result [CONFIRMED]:** in a single tick the page's content collapses from *(package list + sidebar)* to *(a spinner)*. Document height drops by hundreds of pixels. The browser clamps `scrollTop` to the new, much smaller `scrollHeight` — which the user perceives as the page **jumping to the top / navigating unexpectedly**. Then the car grid renders and the page grows again, producing a second shift.

**Secondary defects in the same handler [CONFIRMED]:**
- `setStep(2)` is called unconditionally. If the customer was on step 1 (the category grid) when they clicked edit, `selectedCategory` is still `null`. After picking a car, `handleCarSelect` sets `changingCar = false`, so `ServiceSelector` renders with `category={null}` → `ServiceSelector.jsx:222` reads `category.name` → **`TypeError: Cannot read properties of null`**. (It would first hit the `!packages.length` early return at L205 because `packagesByCategory.get(undefined)` is `[]`, so in practice the customer lands on "No services available in this category" instead of crashing — still wrong.)
- `CartContext.jsx:113-122` `SET_CAR`: if the new car differs in `carId`/`brand`/`model`/`year`, **`services` is wiped to `[]`**. Editing the car silently empties the cart. This is correct behaviour (prices are per-model) but there is **no warning to the customer**.

**Explicitly checked and ruled out as the cause:**
- `scrollIntoView` — **not used anywhere in the project** (grep).
- `window.scrollTo` — only `App.jsx:48` (route change) and 3 places in the admin dashboard. **Not triggered by editing a car**, because `setSearchParams(..., { replace: true })` and state changes do not alter `location.pathname`.
- Router navigation — none in this path.
- `key` changes / focus management — none.

So the jump is **rendering-related (conditional unmount + remount collapsing document height)**, not router- or scroll-API-related.

---

## 7. ADDRESS SYSTEM FINDINGS

### Schema — `server/src/models/User.js:4-12`
Addresses are an **embedded subdocument array on `User`**, not a separate collection:
```js
addressSchema = { label (default 'Home'), street, city, state, pincode, lat, lng }
userSchema.addresses = [addressSchema]
```
No field is `required`; no pincode format validation at the model layer.

### API — `server/src/routes/authRoutes.js:22-24`, `controllers/authController.js:298-350`
| Verb | Route | Handler | Notes |
|---|---|---|---|
| GET | `/api/auth/me` | `getMe` | returns the whole user incl. `addresses`, and `.populate('wishlist', …)` |
| POST | `/api/auth/address` | `addAddress` | `user.addresses.push(req.body)` — **pushes the raw body unvalidated**, returns full `addresses` array |
| PUT | `/api/auth/address/:addressId` | `updateAddress` | truthy-guarded field-by-field copy |
| DELETE | `/api/auth/address/:addressId` | `deleteAddress` | splice by id |

### Frontend
| Capability | Where | Status |
|---|---|---|
| Retrieve saved addresses | `CheckoutModal.jsx:174-190` `loadAddresses()` → `getMe()`; also `Profile.jsx` | ✅ exists |
| Select an address for a booking | `CheckoutModal.jsx` step 3, `selectedAddressId` state | ✅ exists |
| **"+ Add New Address"** | **`CheckoutModal.jsx:836-841` — the button exists, labelled exactly `Add New Address`** | ✅ **already implemented** |
| Add + save from checkout | `CheckoutModal.jsx:301-330` `saveAddress()` → `POST /auth/address`, then re-selects the new one | ✅ exists |
| Add / edit / delete from profile | `Profile.jsx` — tabs `addresses` and `add_address`, with a Leaflet map picker | ✅ exists |
| Geolocation autofill | `CheckoutModal.jsx:210-249` `fetchCurrentAddress()` via **Nominatim (OpenStreetMap)** | ✅ exists |
| Persisted to DB | `User.addresses` | ✅ yes |
| Stored in booking state | `CheckoutModal.jsx:353-357` copies street/city/state/pincode/lat/lng into the booking payload; server re-cleans it | ✅ yes |

### Verdict
**The requested "+ Add New Address → save → appears in saved addresses → selectable later" flow already exists end to end.** Nothing is architecturally missing.

### What is actually wrong with it [CONFIRMED]
1. **`addAddress` pushes `req.body` verbatim** (`authController.js:300-303`). Any client-supplied key that matches the subschema is stored; there is **no server-side validation of pincode format** even though `createServiceBooking` enforces `/^[1-9]\d{5}$/` at booking time. A malformed address saves fine and then blocks checkout.
2. **No delete/edit inside the checkout modal.** A wrong address can only be fixed by leaving checkout and going to `/profile`.
3. **`getMe()` is heavier than it needs to be** for this purpose — it populates the wishlist on every call, and the modal calls it on open.
4. **`updateAddress` uses truthy guards** (`if (req.body.street)`), so a field cannot be cleared to an empty string.
5. **No default-address concept** — `CheckoutModal.jsx:180` just picks `list[0]`.

---

## 8. PAYMENT FLOW — CRITICAL FINDINGS

### The reported bug is real, and the cause is a single line

**`server/src/controllers/serviceController.js:286-292`, inside `createServiceBooking` — which runs *before payment has been attempted at all*:**

```js
  // Confirmation email. Deliberately after the booking is committed and
  // deliberately not awaited into the response path — a mail outage must not
  // cost the customer a booking they have already been charged for.
  if (req.user.email) {
    sendBookingConfirmationEmail(req.user, booking, SERVICE_CENTER_ADDRESS)
      .catch((err) => console.error('[serviceController.bookingEmail]', err.message));
  }
```

The booking is created 33 lines earlier at L253 with:
```js
payment: { method: 'online', status: 'pending' },
statusHistory: [{ status: 'requested', note: 'Service booking created' }],
```

And the email that goes out is `emailService.js:369`:
```js
subject: `Booking confirmed — ${carName} on ${when}`,
…  "Your service booking is confirmed. Here are the details:"
```

**[CONFIRMED ROOT CAUSE]** The customer receives an email titled **"Booking confirmed"** the moment the booking record is written — which happens at `CheckoutModal.jsx:344` (`createServiceBooking`), **step 1 of `handlePay()`**, *before* the Razorpay order is even created at step 2 and long before the customer sees the payment sheet. Whether they then pay, cancel, or fail makes no difference: the email has already been sent. The code comment above the call reveals the intent ("a mail outage must not cost the customer a booking they have already been charged for") — it was written on the assumption that payment had already happened, which is not where it sits in the flow.

### Full architecture as it stands

```
FRONTEND  CheckoutModal.handlePay()  (client/src/components/service/CheckoutModal.jsx:326-471)
  1. createServiceBooking(payload)          POST /api/services/book
       └─ server: validate → price server-side → ServiceBooking.create()
          → payment.status='pending', status='requested'
          → ★ sendBookingConfirmationEmail()  ← FIRE-AND-FORGET, NOT AWAITED
          → 201 { booking }
  2. createServicePayment(id)               POST /api/services/:id/payment
       └─ server: owner check, already-paid check, amount from booking.totalAmount
          → razorpay.orders.create()  → booking.payment.razorpayOrderId = order.id
          → { order, amount, key }
  3. loadRazorpay() → new window.Razorpay({...}).open()
       ├─ modal.ondismiss → setPayError('Payment was cancelled…')   [no server call]
       ├─ rzp.on('payment.failed') → setPayError(...)                [no server call]
       └─ handler(response) →
  4.     verifyServicePayment(id, {order_id, payment_id, signature})
              POST /api/services/:id/verify-payment
       └─ server: HMAC-SHA256(order_id|payment_id, KEY_SECRET) === signature ?
            yes → payment.status='paid', transactionId, paidAt, statusHistory push
            no  → payment.status='failed', 400 error
          → clearCart(); toast('Booking confirmed'); navigate('/my-bookings')
```

### Point-by-point answers to the audit questions

| Question | Answer | Evidence |
|---|---|---|
| Payment provider | Razorpay | `services/paymentService.js`, `config/razorpay.js` |
| Order-creation endpoint | `POST /api/services/:id/payment` | `serviceRoutes.js:30` |
| Verification endpoint | `POST /api/services/:id/verify-payment` | `serviceRoutes.js:31` |
| **Webhook** | **NONE.** Grep for `webhook` across `server/src` and `client/src` returns **zero matches**. | verified |
| Booking-creation endpoint | `POST /api/services/book` | `serviceRoutes.js:22` |
| Booking status values | `requested · accepted · in_progress · completed · cancelled` (default `requested`) | `ServiceBooking.js:109-113` |
| Payment status values | `pending · paid · failed · refunded` (default `pending`) | `ServiceBooking.js:131-135` |
| Email function | `sendBookingConfirmationEmail(user, booking, serviceCenter)` | `emailService.js:323` |
| **Exact condition that triggers the confirmation email** | **`req.user.email` is truthy, immediately after `ServiceBooking.create()` succeeds. There is no payment condition of any kind.** | `serviceController.js:289` |

### Diagnostic checklist

| Check | Verdict |
|---|---|
| Creates the booking before payment? | **YES [CONFIRMED]** — `serviceController.js:253`, called at `CheckoutModal.jsx:344` as step 1 of `handlePay` |
| Marks the booking confirmed before verification? | **Partly.** `booking.status` stays `'requested'` (never auto-advances), and `payment.status` correctly stays `'pending'`. **But the customer-facing artefact — the email — says "Booking confirmed".** So the *data* is honest and the *communication* is not. |
| Sends email before payment verification? | **YES [CONFIRMED]** — the single most important finding |
| Trusts frontend payment success state? | **NO.** `verifyServicePayment` recomputes the HMAC server-side. The frontend cannot fake a paid booking. |
| Missing signature verification? | **NO.** `paymentService.js:16-23` does a correct `HMAC-SHA256(order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)` comparison. |
| Webhook race condition? | **N/A — there is no webhook.** This is itself a gap: see below. |
| Duplicate booking / email logic? | **YES, partly [CONFIRMED].** `handlePay` guards re-entry with `if (paying) return` and reuses `bookingId` on retry (`CheckoutModal.jsx:340`), so a retry does **not** create a second booking or a second email **within the same modal session**. **But `bookingId` is reset to `null` every time the modal opens** (`CheckoutModal.jsx:139`). Close the modal after a failed payment, reopen it, and pay again → **a second `ServiceBooking` is created and a second "Booking confirmed" email is sent**, leaving an orphan unpaid booking that also consumes a slot. |
| Incorrect success/failure condition? | The verify endpoint's condition is correct. **The email's condition is the bug.** |

### Additional payment-flow gaps found

1. **No signature comparison hardening.** `paymentService.js:22` uses `expectedSignature === razorpay_signature` — a plain string compare, not `crypto.timingSafeEqual`. Low practical risk here (the attacker would need the order id), but worth noting.
2. **`RAZORPAY_KEY_SECRET` is read at call time with no guard in `verifyPayment`.** If the env var is unset, `createHmac('sha256', undefined)` throws — the request 500s rather than cleanly reporting misconfiguration. `createServicePayment` *does* guard this (L483-486); `verifyServicePayment` does not.
3. **Cancellation and failure are client-only.** `modal.ondismiss` (L403) and `rzp.on('payment.failed')` (L437) set local error state and make **no server call**. The booking stays `payment.status: 'pending'` with no record of the failed attempt. Combined with the availability bug in §5, every abandoned checkout silently burns a slot.
4. **No webhook means no recovery path.** If the browser dies between Razorpay charging the card and `verify-payment` firing, the money is taken and the booking is never marked paid — with no `payment.captured` webhook to reconcile it. Razorpay's own guidance is to treat the webhook as the source of truth and the handler callback as an optimisation.
5. **`verifyServicePayment` sends no email.** A customer who *does* pay successfully receives **no payment receipt** — only the pre-payment "Booking confirmed" mail.
6. **`booking.status` never advances on payment.** A paid booking still reads `'requested'`. Admin must manually accept it.
7. **`MyBookings.jsx` offers no "pay now" retry.** Grep confirms it has no `createServicePayment` / `Razorpay` usage — it only renders a "Payment pending" pill (L262-264). An unpaid booking is a dead end for the customer.

---

## 9. EMAIL CONFIRMATION FINDINGS

### Service
`server/src/services/emailService.js` (511 lines). Provider chosen at runtime by `resolveProvider()` (L38-43):
1. `BREVO_API_KEY` set → **Brevo transactional HTTPS API** (`https://api.brevo.com/v3/smtp/email`), 15 s `AbortController` timeout.
2. else `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` → **nodemailer SMTP**.
3. else → `sendEmail` **throws**.

Env names are accepted in both the `SMTP_*` and the legacy `MAIL_*`/`EMAIL_*` spellings (L27-35) — a documented historic bug that has been fixed.

### Templates (all inline-styled, `shell()`/`card()`/`row()`/`highlight()` helpers, `esc()` HTML-escaping)
| Template | Function | Trigger |
|---|---|---|
| OTP code | `sendOTPEmail` L202 | `authController.js:182`, `POST /auth/send-otp` |
| Welcome | `sendWelcomeEmail` L282 | `authController.js:77`, on registration (fire-and-forget) |
| **Booking confirmed** | `sendBookingConfirmationEmail` L323 | **`serviceController.js:290`** |
| Booking status update | `sendBookingStatusUpdateEmail` L394 | `serviceController.js:439` |
| Contact form | inline `sendEmail` | `contactController.js:71` |

### Frontend vs backend
**All email is sent from the backend.** No frontend code calls any mail service. **[CONFIRMED by grep.]**

### ★ "What exact code path can send a booking confirmation email even if payment fails?"

**There are TWO such paths. Both are payment-independent.**

**PATH 1 — the primary cause of the reported bug**
```
CheckoutModal.handlePay()  step 1
  → POST /api/services/book
  → serviceController.createServiceBooking          (serviceController.js:82)
  → ServiceBooking.create({ payment: { status: 'pending' } })   (L253-284)
  → if (req.user.email) sendBookingConfirmationEmail(...)       (L289-292)
  → emailService.js:369  subject: "Booking confirmed — <car> on <date>"
```
- **Condition:** `req.user.email` exists. **No payment condition whatsoever.**
- **Fires when:** always, on every successful booking creation.
- **Payment outcome at that moment:** unknown — Razorpay has not even been contacted yet.
- **Not awaited** (`.catch()` only), so it cannot be rolled back or cancelled if payment later fails.

**PATH 2 — a second, independent path**
```
Admin/mechanic sets booking status  →  PUT /api/services/:id/status
  → serviceController.updateBookingStatus           (serviceController.js:398)
  → if (statusChanged && populated.user?.email)
       sendBookingStatusUpdateEmail(...)            (L438-441)
  → emailService.js:407-409, status 'accepted':
       title:   "Booking Accepted"
       message: "Your car service booking has been confirmed!"
```
- **Condition:** the status changed and the user has an email. **`payment.status` is never consulted.**
- **Also auto-fires without an explicit status change:** L411-415 auto-promotes `requested → accepted` the moment a mechanic is assigned. So merely assigning a mechanic to an **unpaid** booking emails the customer "your booking has been confirmed!".

**PATH 3 (duplication vector, same as Path 1)**
Closing and reopening `CheckoutModal` resets `bookingId` to `null` (`CheckoutModal.jsx:139`), so a second attempt creates a **second** booking → **a second "Booking confirmed" email**.

### What is *not* wrong
- `verifyServicePayment` sends **no** email — so there is no duplicate-on-success problem, but also **no payment receipt**.
- Templates correctly escape user input.
- Send failures are logged and swallowed; they never break a booking.

---

## 10. INITIAL LOADING / FETCH FINDINGS

### Every request the landing page makes

| # | Frontend caller | Endpoint | Controller | DB operation | Blocks render? | Awaited? | Timeout | Retry | Silent fail? | Called >1×? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `AuthContext.jsx:44` `useEffect([state.token])` | `GET /api/auth/me` | `authController.getMe` | `User.findById().populate('wishlist')` | no | yes (promise) | 15 s | none | **yes — `.catch(() => {})` swallows everything** | once per token change; **fires on every full page load if logged in** |
| 2 | `Home.jsx:82` (in `Promise.all`) | `GET /api/services/categories` | `serviceController.getServiceCategories` | `ServiceType.find({isActive}).select().sort({categoryId,order})` — **uses index** `{isActive,categoryId,order}` | **partially** — grid shows fallback data until it lands | yes | 15 s | none | logs to console only | once |
| 3 | `Home.jsx:83` (same `Promise.all`) | `GET /api/service-categories` | `serviceCategoryController.getServiceCategories` | **two sequential queries**: `ServiceCategory.find` then `ServiceType.find` | same | yes | 15 s | none | `.catch(() => ({data:{categories:[]}}))` — **fully silent** | once |
| 4 | `Home.jsx:111` `fetchParts` | `GET /api/store/parts/featured` | `partController.getFeaturedParts` | `SparePart.find({isFeatured, isActive}).sort({createdAt:-1})` — **NO LIMIT, NO INDEX** | no (skeletons) | yes | 15 s | manual "Try Again" button only | sets `partsError` | once |
| 5 | `Home.jsx:115` (conditional) | `GET /api/store/parts/recent?limit=5` | `partController.getRecentParts` | `SparePart.find({comingSoon:{$ne:true}, isActive}).sort({createdAt:-1}).limit(5)` — **NO INDEX** | no | yes | 15 s | none | falls back to `featured` | only if featured returned < 5 |

**Navbar makes no API calls.** `PincodeModal` mounts globally in `App.jsx:71` but its auto-show `useEffect` body is **fully commented out** (`PincodeModal.jsx:15-22`) and it returns `null` — so its `/store/parts` availability check never fires on load. **[CONFIRMED — it is inert, but it is still mounted and still bundled.]**

**No booking components mount globally.** `CheckoutModal` is only rendered from `Services.jsx:245`. Confirmed.

### Waterfall shape
Requests 2 and 3 run in parallel (`Promise.all`). Request 5 is **strictly waterfalled behind** request 4 (`.then()` chain, `Home.jsx:111-124`). Requests 1 and 4 start in parallel with 2/3. So worst case on the landing page is **2 round trips deep, 5 requests wide**.

### Why the first load can take a very long time and then "suddenly work" on refresh

The evidence points to **three compounding causes**, in descending order of likely impact:

**A. Server cold start with blocking boot work [SUSPECTED — high confidence]**
`server/src/index.js:30-36` runs, on **every process start**:
```js
connectDB().then(async () => {
  await bootstrapCatalogue();
  await migrateLegacyPaymentMethods();
});
```
- `bootstrapCatalogue()` (`seeds/bootstrap.js`) reads `appmeta`, reads and creates `ServiceCategory` + `ServiceType` documents, and runs a `backfillPackageDetail()` pass.
- `migrateLegacyPaymentMethods()` runs **three `updateMany` scans** over `orders`, `servicebookings` and `rentalbookings` (L219-233) — every boot, forever, even though they match nothing after the first run.

`app.listen` is **not** gated on these — Express starts serving immediately — but the boot work competes for the same MongoDB connection and event loop as the first real requests. On a container that sleeps when idle (Render/Railway free tiers), the sequence *cold container start → Node boot → Atlas TLS handshake → bootstrap + 3 updateMany → serve first request* comfortably exceeds axios's 15 s timeout. **That is precisely the reported symptom: the first attempt appears to hang, and a refresh a minute later is instant because the container is now warm.**
*Cannot be fully confirmed from source — needs the production hosting platform and boot logs. **[UNVERIFIABLE from code alone.]***

**B. A 1.15 MB single JavaScript chunk [CONFIRMED]**
`client/dist/assets/index-Dwm20SzG.js` is **1,150,567 bytes** uncompressed, and there is no `React.lazy`/`Suspense` anywhere. Every first-time visitor to the homepage downloads, parses and executes:
- the 5,887-line admin dashboard (`pages/admin/Dashboard.jsx`)
- **Leaflet + react-leaflet + `leaflet/dist/leaflet.css` + 3 marker PNGs** (statically imported by `Cart.jsx:9-16` and `Profile.jsx:8-10`)
- `framer-motion` (used only in `PartDetail.jsx`)
- `socket.io-client`, `@reduxjs/toolkit`, `react-redux`, `swiper`, `date-fns`, `@react-google-maps/api` — **all unused or near-unused**
- all 20+ page components

On a mid-range Android on 4G, ~330 KB gzipped of JS is roughly **2–4 s of parse/compile alone** before React renders anything. The `#root` div is empty until then — a white screen with no fallback markup in `index.html`.

**C. Unbounded, unindexed parts queries [CONFIRMED]**
`getFeaturedParts` has **no `.limit()`** — it returns every featured `SparePart` with its full document (including `pincodePricing` arrays and image URL lists), and `Home.jsx:126` throws away all but 5 client-side. **`SparePart` has no indexes at all** — grep across `server/src/models/` shows indexes on Bike, ContactMessage, RentalBooking, RentalCar, ServiceBooking, ServiceCar, ServiceCategory and ServiceType, but **none on `SparePart` or `Order`**. Both `{isFeatured, isActive}` and `{comingSoon, isActive}` are therefore **full collection scans**. (This is already logged as known issue #18 in the repo's own `AGENTS.md`.)

### Other loading defects found
- **`AuthContext.jsx:44-53` writes a stale value.** Inside the effect it does `localStorage.setItem('bikeservice_user', JSON.stringify({ ...state.user, ...data.user }))` — but `state.user` is captured from the render that created the effect, and `state.user` is **not** in the dependency array (only `state.token` is). The persisted user can lag the in-memory one.
- **`Home.jsx:142` recomputes `categories` on every render** — not memoised (see §2).
- **`CheckoutModal.jsx:191` `useEffect(..., [open, user, loadAddresses])`.** `user` is an object reference from `AuthContext`. `AuthContext`'s own mount effect dispatches `UPDATE_USER`, producing a **new object identity** — which re-runs this effect and fires a **second `GET /auth/me`**. **[CONFIRMED — duplicate fetch.]**
- **No request has retry logic anywhere.** Only two manual "Try Again" buttons exist (`Home.jsx:600` for parts, `Services.jsx:196` for the catalogue).
- **The 401 interceptor does a full `window.location.href` assignment** (`axios.js:57`), throwing away the SPA and forcing a complete reload + re-download of the 1.15 MB bundle.
- **`index.css:1` imports Google Fonts via CSS `@import`** — a render-blocking request that cannot start until the CSS file itself has downloaded. `index.html` preconnects to the font hosts but never preloads the stylesheet.

---

## 11. NAVBAR / NAVIGATION FINDINGS

**File:** `client/src/components/common/Navbar.jsx` (327 lines).

### Structure
- `<nav>` with `position: sticky; top: 0; z-index: 50` + `backdropFilter: blur(12px)` + `rgba(255,255,255,0.85)` (L81).
- Desktop links: `hidden lg:flex`, from the `navLinks` array (L9-16).
- Mobile: hamburger (`lg:hidden .gk-burger`), panel rendered as a **sibling** of the padded container (L285), `maxHeight: calc(100vh - 64px)`, `overflowY: auto`.
- `useScrollLock(mobileOpen)` (L62) sets `document.body.style.overflow = 'hidden'` while open.
- Two `useEffect`s: close on `location.pathname` change (L66), Escape key listener while open (L69-73).
- Consumes **three contexts**: `useAuth()`, `useCart()`, `useServiceCart()`.
- No API calls. No programmatic navigation except `handleLogout` → `navigate('/')`.

### Where "How It Works" lives
**`Navbar.jsx:13`:**
```js
{ label: 'How It Works', href: '/#how-it-works' },
```
Rendered as `<Link to="/#how-it-works">` in both the desktop row (L91) and the mobile panel (L306). The target is `Home.jsx:658` `<section id="how-it-works">`.

### The navigation "hang" — three distinct mechanisms, all confirmed in code

**Mechanism 1 — "How It Works" does nothing, or scrolls the wrong way [CONFIRMED]**
`App.jsx:45-51`:
```js
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};
```
- **From another page** (e.g. `/services`): clicking "How It Works" navigates to `/`, `pathname` changes, `ScrollToTop` fires `window.scrollTo(0,0)` — the customer lands at the **top of the homepage**, not at the How It Works section. React Router v7 does **not** perform hash scrolling automatically, and there is no `useEffect` anywhere watching `location.hash`. Grep confirms no hash handling exists.
- **Already on `/`**: the `Link` pushes `/#how-it-works`. `pathname` is unchanged, so `ScrollToTop` does not fire — and because React Router uses `history.pushState` rather than a real navigation, **the browser performs no native fragment scroll either**. Result: **the nav item does absolutely nothing.** To the customer that is indistinguishable from a frozen page.

**Mechanism 2 — global smooth scroll turns every navigation into a long animation [CONFIRMED]**
`index.css:13-14`:
```css
html { scroll-behavior: smooth; … }
```
`window.scrollTo(0, 0)` inherits `scroll-behavior` from CSS. So **every route change animates the scroll position back to the top** instead of jumping. Navigating away from deep in the ~6,000 px landing page produces a multi-second animated scroll, over content that is simultaneously being unmounted and replaced. On mobile Safari/Chrome this reads exactly as "the page froze". This is the strongest single explanation for the reported navbar hang. **[CONFIRMED that the code does this; that it is *the* thing the client saw is [SUSPECTED].]**

**Mechanism 3 — no code splitting means a route change can block on nothing… but a cold API can [CONFIRMED / SUSPECTED]**
Because there is no `React.lazy`, route changes need no chunk download — that part is fast. But `/services` mounts `Services.jsx` which immediately fires `Promise.all([getServiceCategories(), getCategories()])` and renders `<LoadingSpinner size="lg" text="Loading services..." />` for the **entire main column** until both resolve (`Services.jsx:190`). Against a cold backend (§10A) that is a spinner for up to 15 s. Same pattern in `CarSelector.jsx:135`.

### Classification of the hang

| Candidate | Verdict |
|---|---|
| Router-related | **Yes** — missing hash-scroll handling makes "How It Works" a no-op |
| Scroll-related | **Yes** — `scroll-behavior: smooth` + `window.scrollTo(0,0)` on every route change |
| API-related | **Yes, on `/services`** — full-column blocking spinner with no timeout feedback |
| Rendering-related | Contributory — the whole landing page unmounts and the destination mounts in one synchronous commit, with a 1.15 MB bundle's worth of components already parsed |
| State-related | Minor — `Navbar` re-renders on any `AuthContext`/`CartContext` change, but nothing here loops |
| Browser/mobile perf | **Yes** — see §12 |
| Loading overlay | **None exists** — there is no global route-transition overlay anywhere |
| Component remounting | `Layout` is re-created inline per `<Route element={...}>`, so `Navbar` and `Footer` **remount on every route change** rather than persisting. Cheap, but not free, and it means the sticky navbar's `backdrop-filter` layer is re-created each time. |

---

## 12. SCROLL PERFORMANCE FINDINGS

### What the exhaustive search found — and did not find

Grep across all of `client/src` for the requested patterns:

| Pattern | Result |
|---|---|
| `window.addEventListener("scroll")` | **ZERO** |
| `document.addEventListener("scroll")` | **ZERO** |
| `scrollIntoView` | **ZERO** |
| `window.scrollTo` | 4 (`App.jsx:48` route change; 3 in admin dashboard) — **none on the landing page** |
| `requestAnimationFrame` | 1 (`utils/responsive.js:50`, inside `useResponsive` — **which nothing consumes**) |
| `IntersectionObserver` | **ZERO** |
| resize listeners | 2 (`utils/responsive.js:65-66` — dead code) |
| `mousemove` / `touchmove` / `wheel` | **ZERO** |
| Framer Motion | imported **only** in `pages/PartDetail.jsx` — not on the landing page |
| GSAP | not installed |
| `swiper` | installed, **never imported** |
| Video / background video | **ZERO** |
| Third-party scripts | Razorpay checkout.js — injected **on demand** in `handlePay`, not on load. Google Fonts via CSS `@import`. Nominatim — only on button click. |

**This is the most useful negative result in the audit: the classic JS causes of scroll jank are simply not present on this landing page.** The problem is therefore in **paint and compositing**, not in JavaScript.

### The actual bottlenecks, ranked

**1. Sticky navbar with `backdrop-filter: blur(12px)` [CONFIRMED — highest-confidence cause]**
`Navbar.jsx:81`:
```jsx
<nav style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', … }}
     className="sticky top-0 z-50">
```
A `backdrop-filter` on a `position: sticky` element forces the compositor to **re-sample and re-blur everything behind the navbar on every single scroll frame**. On mobile GPUs this is one of the most expensive things a page can do — and it is unavoidable, because the whole point of the element is that it stays pinned while content moves under it. `index.css:188-203` adds three more `backdrop-filter: blur(12px…16px)` rules. This alone can cap a mid-range Android at 20–30 fps for the entire page.

**2. Continuously running CSS animations on large blurred gradients [CONFIRMED]**
`Home.jsx:167-226` defines `.gk-glow-a` (`min(720px,100%)` radial gradient, 18 s drift), `.gk-glow-b` (`min(560px,100%)`, 22 s drift), `.gk-shimmer` (6.5 s `background-position` sweep on `background-clip: text`), `.gk-car` (7 s float). Plus `Home.jsx:451` a separate `filter: blur(30px)` element behind the hero image.

**Partially mitigated already:** `Home.jsx:230-233` kills `.gk-glow-*` and `.gk-car` animations below 900 px, and L236-240 respects `prefers-reduced-motion`.

**Not mitigated:**
- **`.gk-shimmer` still animates on mobile.** It animates `background-position` on a `-webkit-background-clip: text` element — this **repaints the H1 text every frame, indefinitely**, and text repaints are expensive. It is not in the mobile kill-list.
- **`filter: blur(30px)` at `Home.jsx:451` is inside `.gk-hero-img`**, which *is* `display: none` below 900 px — so that one is fine.
- The `.gk-grid-overlay` (L187-195) uses a **`mask-image: radial-gradient(...)`** on a full-bleed absolutely-positioned layer. Masks force an extra compositing layer and are not cheap on mobile. Never disabled.

**3. Unoptimised, eagerly-loaded, undimensioned images decoding during scroll [CONFIRMED]**
- 4 testimonial JPEGs totalling **~250 KB** (110 KB / 73 KB / 48 KB / 19 KB) rendered at **42×42 px**, no `loading="lazy"`, no `width`/`height`, no `decoding="async"`. They decode at full resolution and are downsampled at paint time. If they decode while the user is scrolling past the testimonials section, the main thread stalls — which matches "sometimes appears to completely freeze for a moment".
- Hero PNG 196 KB, navbar logo PNG **210 KB at 44 px**, both eager and undimensioned.
- **`Home.jsx` has 5 `<img>` tags and not one of them has `loading`, `width`, `height`, or `decoding`.**

**4. Expensive box-shadows repeated across many elements [CONFIRMED]**
Every card on the page carries a large blurred shadow: `0 20px 45px rgba(...)` (booking card), `0 6px 18px` × 5 (why-choose), `0 8px 24px` × 4 (testimonials), `0 6px 18px` + `0 14px 28px` on hover × 12 (service cards), plus glows on every CTA. Large blur radii are per-pixel work on every repaint.

**5. Large DOM with no virtualisation and no memoisation [CONFIRMED]**
The landing page renders ~12 service cards + 5 part cards + 5 why-choose + 4 how-it-works + 4 stats + 4 testimonials, each a nested flex/grid tree with inline styles. **Every inline `style={{}}` object is a new object identity on every render**, so React cannot bail out of any of these subtrees. Combined with `Home.jsx:142` recomputing `categories` unmemoised, any state change on Home (e.g. `partsLoading` flipping) re-renders and re-diffs the **entire** page.

**6. Per-card window listeners [CONFIRMED, minor]**
`PartCard.jsx:24-30` registers a `pincode-updated` window listener **per card**. With 5 cards on the homepage that is 5 listeners — negligible here, but 20+ on `/parts`.

**7. `overflow-x: clip` on `html`, `body`, `#root` and `main` simultaneously [SUSPECTED]**
`index.css:15, 31, 46`. Stacking clip containers can, on some mobile WebKit builds, promote extra layers and interfere with scroll optimisation. Worth measuring; not provable from source.

### Most likely explanation for what the senior saw
**`backdrop-filter` on the sticky navbar (constant per-frame cost, explains the *lag*) + full-resolution image decodes of the testimonial JPEGs and hero PNG (one-off main-thread stalls, explains the *momentary freeze*), on top of a 1.15 MB JS bundle still being parsed on first load.** All three are confirmed present in code; the relative weighting needs a Chrome DevTools performance trace on the actual device to prove. **[SUSPECTED ranking, CONFIRMED ingredients.]**

---

## 13. CHECKOUT UI FINDINGS

### "Proceed to Checkout"
**`client/src/components/service/ServiceCart.jsx:99-118`** — inside `<aside>` at L11-17:
```js
position: 'sticky', top: '5rem', alignSelf: 'flex-start'
```
Rendered from `Services.jsx:234-243` **only when `car && !changingCar`**, in a `300px` fixed-width sidebar.

### "Select Car"
There is **no button with that label**. Car selection happens two ways:
- `CarSelector.jsx:189-234` — the car catalogue grid (each card is a button), shown when `needsCar` is true.
- `ServiceCart.jsx:56-63` — a small **pencil icon** (`<Pencil size={14} />`, ~14 px, no text label) as the "change car" affordance.

### Current layout
| Viewport | Behaviour |
|---|---|
| ≥ 901 px | Two columns: main content `flex: 1`, sidebar `width: 300px`. Cart is **sticky at `top: 5rem`** — always visible while scrolling packages. Works well. |
| ≤ 900 px | `Services.jsx:158-161`: `.gk-svc-layout { flex-direction: column }` and `.gk-svc-cart { width: 100% }`. The cart **drops below** the full package list. |

### Mobile problem [CONFIRMED]
On a phone, the order becomes:
```
Header  →  Back button  →  Package list (N cards, each ~350–450 px tall)  →  Cart  →  Proceed to Checkout
```
`position: sticky; top: 5rem` on a **full-width block element in a single-column flow** does nothing useful — the element is already at the bottom of the document, so there is nothing left to stick to. The customer must scroll **past every package card** to reach the total and the CTA, then scroll back up to add another service. With 3–4 packages in a category (each `~1rem 1rem` padded, 168 px image on mobile per `ServiceSelector.jsx` `@media (max-width: 560px)`), that is easily 1,500+ px of scrolling per round trip.

**There is no mobile sticky/fixed bottom bar anywhere in the service flow.** Grep for `position: fixed` in the service components returns only the two modal overlays (`CheckoutModal.jsx:509`, `PincodeModal.jsx:59`).

### CheckoutModal CTA placement
- **Steps 1–3:** footer nav bar with Back + Continue (`CheckoutModal.jsx:1015-1055`), inside the modal's own flex column — effectively pinned because the body scrolls independently (`overflowY: auto; flex: 1` at L548). This part is fine.
- **Step 4:** the footer is **hidden** (`{step < 4 && (...)}` at L1015), and the "Pay ₹X" button sits at the **end of the scrollable body** (L986-1006) after the summary card, the schedule/address list, and any error banner. On a short mobile viewport the customer must scroll inside the modal to find the pay button. **[CONFIRMED]**
- The modal has `maxHeight: 92vh` and the outer overlay also has `overflowY: auto` (L513) — **nested scroll containers**, which on iOS produces scroll-chaining confusion.
- **No media queries at all in `CheckoutModal.jsx`.** The 4-item stepper (L525-547) keeps 28 px circles + `0.75rem` uppercase labels in four `flex: 1` tracks at every width.

---

## 14. DUPLICATED CONTENT FINDINGS

Comparing the nine landing sections against each other:

**Section 2 — Booking Steps Bar ("Book Your Service in 3 Easy Steps")**
- Content: Step 1 Select Service · Step 2 Select Date & Time · Step 3 Confirm Booking + a "Book Service Now" CTA.
- **Overlaps Section 6 (How It Works) almost completely.** How It Works says: 01 Pick a Service · 02 Book Your Slot · 03 We Pickup · 04 Service & Return. Steps 1–2 are **the same two steps written twice**, ~2,000 px apart on the same page. **[CONFIRMED duplication.]**

**Section 5 — Why Choose GK Motors (5 cards)**
- Content: 100% Genuine Parts · Trained Technicians · Doorstep Service · Transparent Pricing · 12-Month Warranty.
- **Overlaps Section 1 (Hero trust tags):** `TRUST_TAGS` = Certified Mechanics · Genuine Parts · Affordable Pricing. **All three are restatements** of Why-Choose items 2, 1 and 4.
- **Overlaps Section 7 (Stats):** Stats includes "100% — Genuine Parts", which is Why-Choose card 1 as a number.
- **Overlaps Section 9 (Final CTA):** its body text says "Transparent pricing, genuine parts, and a 12-month warranty" — **Why-Choose cards 4, 1 and 5 compressed into one sentence**.
- **Overlaps Section 6:** How It Works step 03 "We Pickup — We collect your car from your doorstep at no extra cost" is Why-Choose card 3 "Doorstep Service — Free doorstep pickup & drop".
**Net: the "genuine parts / doorstep / warranty / pricing" claim set appears in FIVE places. [CONFIRMED]**

**Section 1 — Hero social proof** — "Trusted by 10,000+ Car Owners" + "4.8/5 Rating".
- **Overlaps Section 7 (Stats)** exactly: "10,000+ Happy Customers" and "4.8/5 Customer Ratings" are the same two numbers.
- **Overlaps Section 8 (Testimonials)** heading "Trusted by Thousands". **[CONFIRMED — three restatements of the same social proof.]**

**Sections 7 + 8 — Stats and Testimonials** — both exist to establish trust, sit adjacent, and both re-assert the 4.8/5 rating (Stats card 2; five gold stars on all four testimonial cards).

**Sections 1, 2, 3, 9 — CTA density.** "Book Service Now" appears at Hero (L392), Booking Steps Bar (L541), Final CTA (L753), plus "View All Services" at Hero (L412) and in Services (L594), plus the Navbar's own "Book Service" (L119) and the mobile drawer's (L288). **Seven CTAs pointing at `/services` on one page.**

**Insurance/service content** — `Insurance Claims` is category 12 in `Services.jsx` `FALLBACK_CATEGORIES` but is placed **6th** in `Home.jsx` `FALLBACK_CATEGORIES`. Two hardcoded lists that have already diverged. **[CONFIRMED — a maintenance duplication, not a content one.]**

### Sections that could be combined or cut

| Merge | Rationale |
|---|---|
| **Booking Steps Bar (2) → How It Works (6)** | Same content. Keep one 4-step explainer. Deleting the Steps Bar also removes the `margin-top: -2.5rem` overlap hack (`Home.jsx:250`), which is a mobile layout liability. |
| **Hero trust tags (1) → Why Choose Us (5)** | Three of five claims duplicated. Either cut the hero tags or reduce Why-Choose to the two claims the hero does not make (Doorstep, Warranty). |
| **Stats (7) + Testimonials (8)** | Both trust sections, adjacent, sharing the 4.8/5 figure. Could be one section with the stats row as a header strip above the reviews. |
| **Final CTA (9) body copy** | Restates three Why-Choose cards. Cut the body sentence; keep the heading and buttons. |
| **`FALLBACK_CATEGORIES` × 2** | Extract to one shared module. Not a UI change, but it is the cause of the ordering inconsistency between Home and /services. |

**Estimated impact:** removing the Booking Steps Bar and merging Stats into Testimonials removes roughly **2 full sections (~700–900 px on mobile)** and 2 of the 7 CTAs, without losing a single unique claim.

---

## 15. ROOT CAUSES

**Ranked by business impact.**

| # | Issue | Root cause | Confidence | Layer |
|---|---|---|---|---|
| **1** | **Failed payment still gets "Booking Confirmed" email** | `sendBookingConfirmationEmail` is called at `serviceController.js:289`, inside `createServiceBooking`, immediately after `ServiceBooking.create()` — with `payment.status: 'pending'` and before `POST /:id/payment` has even run. The email is conditioned only on `req.user.email`. A second, independent path exists at `serviceController.js:439` (`updateBookingStatus` → 'accepted' → "your booking has been confirmed!") which also never checks `payment.status`. | **CONFIRMED** | Backend |
| **2** | Duplicate bookings + duplicate emails on payment retry | `CheckoutModal.jsx:139` resets `bookingId = null` on every modal open. Reopening after a failure creates a second `ServiceBooking` (and a second email). | **CONFIRMED** | Frontend |
| **3** | Abandoned checkouts permanently consume time slots | `getAvailability` (`serviceController.js:340-348`) counts `status: 'requested'` without checking `payment.status`. Bookings are created pre-payment. Nothing expires them. | **CONFIRMED** | Backend |
| **4** | Landing page scroll lag on mobile | `backdrop-filter: blur(12px)` on the `position: sticky` navbar (`Navbar.jsx:81`) forces a per-frame GPU re-blur of everything behind it, for the entire page height. | **CONFIRMED (present); ranking SUSPECTED** | Frontend/CSS |
| **5** | Momentary scroll freezes | 250 KB of full-resolution testimonial JPEGs + a 196 KB hero PNG + a 210 KB navbar logo, all eager, none with `width`/`height`/`loading`/`decoding`. Full-res decode on the main thread. | **CONFIRMED** | Frontend/assets |
| **6** | Very slow first load, "stuck", fine after refresh | (a) Server cold start with `bootstrapCatalogue()` + 3 `updateMany` scans on every boot (`index.js:30-36`) exceeding axios's 15 s timeout on a sleeping container; (b) a **1,150,567-byte single JS chunk** with zero code splitting; (c) unindexed, unlimited `SparePart` queries. | (a) **SUSPECTED** (needs host logs) · (b)(c) **CONFIRMED** | Infra + Frontend + DB |
| **7** | "How It Works" navbar item appears to do nothing | `Link to="/#how-it-works"` + no hash-scroll handler anywhere + `ScrollToTop` (`App.jsx:45-51`) forcing `scrollTo(0,0)` on pathname change. From `/` the pathname never changes, so nothing at all happens. | **CONFIRMED** | Frontend/router |
| **8** | Navigation feels like it hangs | `index.css:14` `html { scroll-behavior: smooth }` makes `window.scrollTo(0,0)` in `ScrollToTop` **animate** on every route change — a multi-second scroll from deep in a ~6,000 px page — while the destination mounts. | **CONFIRMED (mechanism); attribution SUSPECTED** | Frontend/CSS |
| **9** | Editing the car jumps the page / behaves oddly | `Services.jsx:239` sets `changingCar = true`, which unmounts the sidebar (L234) **and** swaps `ServiceSelector` for a freshly-mounting `CarSelector` (L227) that renders only a spinner while it fetches. Document height collapses; the browser clamps `scrollTop`. `setStep(2)` with `selectedCategory === null` is a second defect in the same handler. | **CONFIRMED** | Frontend |
| **10** | Services layout cannot express 4-large + 8-compact | `ServiceCategoryGrid.jsx` has exactly one card component and one style block, **by explicit design** (documented at L5-27). The ordering half already exists (`LEAD_CATEGORY_IDS = [1,2,5,7]`). | **CONFIRMED** | Frontend only — **no data change needed** |
| **11** | Mobile responsiveness inconsistent | Three parallel responsive systems (Tailwind classes, per-component `<style>` with `!important`, a 1,090-line `index.css`) across **eight** breakpoints, plus a `utils/responsive.js` whose canonical breakpoints nothing follows. `CheckoutModal.jsx` has **zero** media queries. Overflow is *clipped* (`overflow-x: clip` in four places) rather than prevented. | **CONFIRMED** | Frontend/CSS |
| **12** | Checkout CTA unreachable without long scrolling on mobile | `ServiceCart` is `position: sticky` inside a `flex-direction: column` single-column flow (`Services.jsx:158-161`) — sticky is a no-op there. No fixed bottom bar exists. | **CONFIRMED** | Frontend |
| **13** | No fuel-type step; catalogue-car fuel not editable | `CarSelector.chooseCatalogueCar` (L83-95) copies `car.fuelType` from the DB; the fuel `<select>` exists only in the manual-entry form. No `User.vehicles` garage exists at all. | **CONFIRMED** | Frontend + Data model |
| **14** | Landing page repeats itself | Hero trust tags, Booking Steps Bar, Why Choose Us, How It Works, Stats and Final CTA copy restate the same 4–5 claims. Seven CTAs to `/services`. | **CONFIRMED** | Content |
| **15** | No payment receipt; no way to pay later | `verifyServicePayment` sends no email; `MyBookings.jsx` has no retry-payment path (verified by grep). | **CONFIRMED** | Backend + Frontend |

---

## 16. FILES / COMPONENTS THAT WILL NEED CHANGES

### Backend
| File | Change | For issue |
|---|---|---|
| `server/src/controllers/serviceController.js` | **Move `sendBookingConfirmationEmail` out of `createServiceBooking` (L289) into `verifyServicePayment` (after L533), gated on the signature having verified.** Add a `payment.status` guard to `updateBookingStatus`'s email (L438). Add `payment.status: 'paid'` (or a paid-OR-recent filter) to `getAvailability`'s `$match` (L343-345). Optionally advance `booking.status` on successful payment. | 1, 3, 15 |
| `server/src/services/emailService.js` | Split "booking received (payment pending)" from "booking confirmed (paid)" — two templates, two subjects. Optionally add a payment-receipt mail. | 1, 15 |
| `server/src/routes/serviceRoutes.js` | Add a Razorpay **webhook** route (unauthenticated, raw-body, webhook-secret verified) and/or a `POST /:id/payment-failed` endpoint the client can call from `ondismiss`/`payment.failed`. | 6 (payment recovery), 3 |
| `server/src/services/paymentService.js` | Guard `RAZORPAY_KEY_SECRET` before `createHmac`; use `crypto.timingSafeEqual`. | payment hardening |
| `server/src/controllers/authController.js` | Validate the address body in `addAddress` (L298-303) — same pincode rule the booking controller uses. Allow clearing fields in `updateAddress`. | §7 |
| `server/src/models/SparePart.js`, `models/Order.js` | Add indexes: `{isFeatured:1,isActive:1}`, `{comingSoon:1,isActive:1,createdAt:-1}`, `{isActive:1,createdAt:-1}`. | 6 |
| `server/src/controllers/partController.js` | Add `.limit()` to `getFeaturedParts` (L50-56) and `getBestsellerParts`. | 6 |
| `server/src/index.js` | Move `bootstrapCatalogue()` + `migrateLegacyPaymentMethods()` off the boot path (or make the migration run once and record it in `appmeta`). | 6 |
| `server/src/models/ServiceCar.js`, `models/ServiceBooking.js` | **Only if** the fuel enum must be narrowed to petrol/diesel/cng — see the warning in §18. | 13 |

### Frontend — landing page & performance
| File | Change | For issue |
|---|---|---|
| `client/src/components/common/Navbar.jsx` | Remove or gate `backdropFilter` (opaque background on mobile). | 4 |
| `client/src/pages/Home.jsx` | Add `width`/`height`/`loading="lazy"`/`decoding="async"` to all 5 `<img>`. Add `.gk-shimmer` to the ≤900 px animation kill-list (L230-233). Memoise `categories` (L142). Add mobile section-padding overrides. Remove the Booking Steps Bar; merge Stats into Testimonials. | 5, 4, 14 |
| `client/src/index.css` | Scope or remove `html { scroll-behavior: smooth }` (L14). Reduce the four `backdrop-filter` rules (L188-203). Consolidate breakpoints. | 8, 4, 11 |
| `client/src/App.jsx` | Make `ScrollToTop` hash-aware (scroll to `location.hash` target when present, `scrollTo(0,0)` with `behavior:'instant'` otherwise). Hoist `Layout` out of the render so `Navbar`/`Footer` stop remounting. Convert routes to `React.lazy` + `Suspense`. | 7, 8, 6 |
| `client/src/pages/Cart.jsx`, `pages/Profile.jsx` | Lazy-load Leaflet (dynamic `import()`), so it leaves the main chunk. | 6 |
| `client/src/pages/admin/Dashboard.jsx` | Route-level `React.lazy` — 5,887 lines must not ship to homepage visitors. | 6 |
| `client/public/*`, `client/src/assets/*` | Re-encode: `gkmotorslogo.png` (210 KB → a ~44 px-tall WebP/SVG), 4 testimonial JPEGs (250 KB → ~4 KB of 96×96 WebP), `hero-gt3-silver.png` (196 KB → WebP). Delete unused `hero-car.png` (848 KB), `logo.png` (988 KB), `car.png` (192 KB), `logo.jpg` (210 KB) if genuinely unreferenced. | 5, 6 |
| `client/package.json` | Remove `@reduxjs/toolkit`, `react-redux`, `@react-google-maps/api`, `swiper` (verified unused). **Phase 2 only, after a grep re-check.** | 6 |

### Frontend — services, booking, checkout
| File | Change | For issue |
|---|---|---|
| `client/src/components/service/ServiceCategoryGrid.jsx` | Add a large-card variant; split render into `slice(0,4)` (2×2 large) + `slice(4)` (compact). `LEAD_CATEGORY_IDS` already resolves to the right four. Preserve the equal-height invariant. | 10 |
| `client/src/pages/Services.jsx` | Fix `onChangeCar` (L239): don't unmount the sidebar; preserve `selectedCategory`; don't force `setStep(2)` blindly. Extract the shared `FALLBACK_CATEGORIES`. Add a mobile sticky checkout bar. | 9, 12 |
| `client/src/components/service/ServiceCart.jsx` | Mobile variant: fixed bottom bar (total + "Proceed to Checkout") below 900 px. Give the pencil icon a text label and a confirm step before wiping services. | 12, 9 |
| `client/src/components/service/CarSelector.jsx` | Render the existing car grid while refetching instead of replacing everything with a spinner (L135). Add a fuel-type selector for catalogue cars if the fuel step is wanted. | 9, 13 |
| `client/src/components/service/CheckoutModal.jsx` | **Add media queries — the file currently has none.** Pin the Pay button (step 4) the way steps 1–3 pin Continue. Persist `bookingId` across modal opens (or across the session) so a retry cannot duplicate a booking. Fix the duplicate `getMe` (L191 dependency on the `user` object identity). Collapse the stepper to icons-only on narrow screens. | 11, 13, 2, 6 |
| `client/src/pages/MyBookings.jsx` | Add a "Complete payment" action for `payment.status === 'pending'` bookings. | 15 |
| `client/src/context/AuthContext.jsx` | Fix the stale `state.user` capture in the `getMe` effect (L44-53). | §10 |

---

## 17. RECOMMENDED IMPLEMENTATION ORDER

**Phase 2A — Correctness (do first; these are business-logic bugs, not polish)**
1. **Move the confirmation email behind payment verification.** Split into "booking received" (pre-payment, honest subject) and "booking confirmed" (post-verification). Add a `payment.status === 'paid'` guard to the status-update email.
2. **Stop duplicate bookings on retry** — persist `bookingId` across `CheckoutModal` opens.
3. **Record payment failure/cancellation server-side** and exclude unpaid bookings from `getAvailability`.
4. **Add the Razorpay webhook** as the source of truth for `payment.captured` / `payment.failed`.
*Rationale: #1 is a customer-trust and potential-dispute issue; the rest all stem from the same "booking exists before payment" design and are cheapest to fix together while that code is open.*

**Phase 2B — Perceived performance (highest visible win per hour of work)**
5. Remove `backdrop-filter` from the sticky navbar on mobile.
6. Re-encode and dimension every landing-page image; add `loading="lazy"` / `decoding="async"`.
7. Scope `scroll-behavior: smooth`; make `ScrollToTop` instant and hash-aware.
8. Add the `.gk-shimmer` mobile kill and memoise `Home`'s `categories`.
*Rationale: 5–8 are small, low-risk CSS/markup edits that directly address what the client felt.*

**Phase 2C — Load time**
9. Route-level `React.lazy` + `Suspense` (biggest win: admin dashboard, Cart, Profile, PartDetail).
10. Dynamic-import Leaflet.
11. Add the missing `SparePart` / `Order` indexes; add `.limit()` to `getFeaturedParts`.
12. Move `bootstrapCatalogue` / `migrateLegacyPaymentMethods` off the boot path; **first confirm the hosting platform and read a real cold-start log** to validate the cold-start hypothesis.

**Phase 2D — Navigation & booking UX**
13. Fix `onChangeCar` in `Services.jsx` (preserve `selectedCategory`, keep the sidebar mounted, keep the car list rendered while refetching).
14. Decide "How It Works" — either implement hash scrolling properly or remove the nav item (the brief says *do not remove it yet*, so implement it).
15. Add the mobile sticky checkout bar; pin the Pay button in step 4.

**Phase 2E — Layout & content**
16. Services 4-large + 8-compact grid.
17. `CheckoutModal` responsive pass (it has no media queries today).
18. Landing-page deduplication: remove the Booking Steps Bar, merge Stats into Testimonials, trim Final-CTA body copy, reduce mobile section padding.
19. Testimonials → 1 column on mobile.

**Phase 2F — Cleanup (lowest risk, do last)**
20. Extract the shared `FALLBACK_CATEGORIES`.
21. Consolidate breakpoints onto `utils/responsive.js`'s canonical set.
22. Remove unused dependencies after a fresh grep.
23. Address validation in `addAddress`.

---

## 18. RISKS / THINGS THAT MUST NOT BE BROKEN

### Critical invariants — verified present, must survive Phase 2

1. **Server-side price authority.** `serviceController.js:130-172` resolves every price from `ServiceCar.servicePrices` → `ServiceType.basePrice` and **rejects** a client total that differs by more than ₹1. Never relax this to "fix" a mismatch — it is what stops a tampered cart from underpaying.
2. **Razorpay signature verification.** `paymentService.js:16-23` must keep computing the HMAC server-side. When moving the confirmation email into `verifyServicePayment`, place it **after** `await booking.save()` and **inside** the verified branch (L525-533) — never before the `isValid` check.
3. **Verify-payment idempotency.** `serviceController.js:511-514` returns success for an already-paid booking. Razorpay can fire the handler twice; keep this. If the email moves here, it must be sent **only on the transition** to paid, not on the idempotent re-entry — otherwise the fix creates a duplicate-email bug.
4. **Email is fire-and-forget.** Every send uses `.catch()` and is never awaited into the response (`serviceController.js:290`, `authController.js:77`). A mail outage must not fail a paid booking. Preserve this shape when moving the call.
5. **Server-side pickup/drop re-validation in IST.** `serviceController.js:40-52` + `utils/istTime.js`. The client mirrors it (`CheckoutModal.jsx:40-53`); both must stay in step or the UI will offer slots the server rejects.
6. **Address whitelisting.** `cleanAddress()` (`serviceController.js:55-63`) copies only known fields. Do not replace it with a spread.
7. **Legacy booking compatibility.** `ServiceBooking` keeps `bikeBrand`/`bikeModel`/`bikeYear`/`serviceLabel`/`isPickupDrop` mirrored alongside the new `selectedCar`/`services`/`pickupDrop` (`serviceController.js:266-272`). The admin dashboard reads the legacy fields. **Removing them will break the admin table.**
8. **Cart validation and cross-tab sync.** `CartContext.jsx` shape-checks anything from `localStorage` (`isValidServiceCart`, `isValidPartsCart`) and uses `writingRef` latches to ignore its own storage echoes. Both carts (`gkmotors_service_cart`, `gkmotors_parts_cart`) are live.
9. **Tier exclusivity.** Within a category, `basic`/`standard`/`comprehensive` replace one another while `single` stacks — enforced in both `CartContext.ADD_SERVICE` (L124-131) and `addService` (L346-361). Changing one without the other desynchronises the toast from the state.
10. **Equal-height service cards.** `ServiceCategoryGrid.jsx:5-27` documents `grid-auto-rows: 1fr` + `height: 100%` + `margin-top: auto` + the two `min-height` clamps as the mechanism. A new large-card variant must reproduce this within its own grid.
11. **`ServiceCategoryGrid` has two call sites.** `Home.jsx:592` (`<Link>`, `limit={12}`) and `Services.jsx:211` (`<button>` via `onSelect`, no limit). A change affects both — test both.
12. **Express route ordering.** Static segments are registered before `:id` in `serviceRoutes.js`, `partRoutes.js`, `serviceCarRoutes.js`, `serviceCategoryRoutes.js`. Inserting a route in the wrong position silently breaks the one below it.
13. **Boot-time catalogue bootstrap is load-bearing.** `bootstrapCatalogue()` creates the 12 categories and their packages. If it is moved off the boot path, **there must be an explicit alternative** (a deploy step or a `/api/health`-triggered check) — otherwise a fresh database serves an empty site.
14. **`overflow-x: clip` is currently masking real overflow.** Removing it during a responsive cleanup will *reveal* horizontal scrollbars that exist today. Fix the offending children first, then remove the clip — not the other way round.

### Specific hazards for planned Phase 2 changes

- **⚠️ Narrowing the fuel enum to petrol/diesel/cng.** `ServiceCar.js:34` and `ServiceBooking.js:27` both allow `electric` and `hybrid`. Mongoose validates on `save()`, not only on create — so **any existing car or booking carrying `electric`/`hybrid` will throw a `ValidationError` the next time an admin edits it**, on a field they never touched. This is exactly the failure mode the `migrateLegacyPaymentMethods` migration exists to undo for `'cod'`. **Before narrowing: query for existing values and migrate them, or keep the enum wide and narrow only the UI.**
- **⚠️ Moving the confirmation email.** Customers who book but do not pay will now receive *nothing* unless a "booking received / payment pending" mail is added. Send that one instead — silence after a checkout attempt is its own support problem.
- **⚠️ Excluding unpaid bookings from `getAvailability`.** This will **increase** apparent availability. Confirm with the business whether a pending booking should hold its slot for a grace period (e.g. 15 minutes) rather than not at all.
- **⚠️ `React.lazy` on routes** introduces a suspense boundary. Without a `fallback` that matches the current layout, route changes will flash. Provide a skeleton, not a spinner.
- **⚠️ Removing `backdrop-filter`** changes the navbar's visual identity. Use an opaque or near-opaque background on mobile only, so the desktop look is preserved.
- **⚠️ Deleting `Home.jsx`'s Booking Steps Bar** also removes `.gk-booking-card`'s `margin-top: -2.5rem` overlap with the hero (L250) — check the hero's bottom padding still reads correctly afterwards.
- **⚠️ `client/dist/` is committed** and is dated 24 August. Any conclusion drawn from bundle size is from that build; re-run `npm run build` before measuring Phase 2 improvements.
- **⚠️ Removing unused dependencies.** `framer-motion` **is** used by `PartDetail.jsx` and `socket.io-client` **is** used by the admin dashboard — do not remove those. Only `@reduxjs/toolkit`, `react-redux`, `@react-google-maps/api` and `swiper` were verified unused.

### Pre-existing issues found but out of scope for the stated brief
Documented here so they are not "discovered" as regressions later. Several are already listed in the repo's own `AGENTS.md` §9.
- `server/.env.example` is committed **containing what appear to be real live credentials** (Mongo URI with password, Razorpay keys, Cloudinary secret). **These should be rotated.** *(AGENTS.md #1)*
- The `/admin` route guard is client-side only; security rests on `adminOnly` at the API layer.
- `POST /auth/send-otp` creates a user record for any unknown email — an unauthenticated account-creation vector. *(AGENTS.md #8)*
- Wishlist has two competing sources of truth (`User.wishlist` vs `localStorage['moto_wishlist']`). *(AGENTS.md #12)*
- Parts stock is decremented at order creation and never restored on cancellation or payment failure. *(AGENTS.md #15)*
- `Socket.IO` is configured with `cors.origin: '*'` (`index.js:90-94`).
- The legacy `POST /api/services` single-service booking endpoint is still routed and does **zero validation** — it spreads `req.body` straight into `ServiceBooking.create()` (`serviceController.js:69-76`).
- `utils/responsive.js` exports `useResponsive` and `useDebounce`, which nothing imports.
- `PincodeModal` is mounted globally in `App.jsx:71` but its logic is fully commented out — dead weight in the tree and the bundle.

---

## Appendix — what could NOT be determined from source

| Question | Why not | How to resolve in Phase 2 |
|---|---|---|
| Is the backend on a sleeping free-tier host? | No deploy config for the server is in the repo (only `client/vercel.json`). | Check the hosting dashboard; read a cold-start log with timestamps. |
| Actual mobile frame timings and which paint cost dominates | Requires a device trace. | Chrome DevTools performance recording on the client's actual phone, scrolling `/`. |
| Real MongoDB query timings and collection sizes | Needs Atlas metrics. | Atlas Profiler; `explain()` on the `SparePart` featured/recent queries. |
| Whether any existing `ServiceCar`/`ServiceBooking` uses `electric`/`hybrid` | Needs a DB read. | `db.servicecars.distinct('fuelType')` and `db.servicebookings.distinct('selectedCar.fuelType')` **before** narrowing the enum. |
| Whether the reported failed-payment email came via Path 1 or Path 2 | Both are possible. | Check the Brevo send log for the affected customer: subject `"Booking confirmed — …"` = Path 1; `"Status Update: Booking Accepted — …"` = Path 2. |
| Whether `hero-car.png` / `logo.png` / `car.png` / `logo.jpg` are referenced anywhere | Grep found no `src/` references, but they could be referenced from the DB (seeded category/package images). | Query `ServiceCategory.image` and `ServiceType.image` before deleting. |
| Whether the committed `client/dist/` matches current source | It is dated 24 Aug. | Rebuild before measuring. |

---

*End of Phase 1 audit. No project files were modified.*
