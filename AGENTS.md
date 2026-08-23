# AGENTS.md — AutoXpress (Car-service-website)

> Context file for AI coding agents. Read this fully before touching code.
> Repo: `https://github.com/HarshKumarhk07/AutoXpress` · branch `main`
> Production frontend: `https://autoexpress.avanienterprises.in`

---

## 0. The single most important thing to know

**The code says "bike". The product is CARS.**

This started life as a two-wheeler platform ("MotoXpress", "bikeservice") and was
pivoted to a car platform ("AutoXpress") without renaming anything. Do not "fix"
this casually — the names are load-bearing across DB collections, API paths,
localStorage keys and file names.

| You see | It actually means |
|---|---|
| `Bike` model / `bikes` collection | Cars listed for sale |
| `GET /api/bikes` | List cars for sale |
| `client/src/pages/BuyBikes.jsx` | Buy **cars** page (route `/bikes`) |
| `client/src/pages/SellBike.jsx` | Sell **your car** page (route `/sell`) |
| `components/bikes/BikeCard.jsx` | exports `CarCard` — renders a car |
| `ServiceBooking.bikeBrand` / `.bikeModel` | Car brand / car model |
| `SparePart.compatibleBikes` | Compatible cars |
| `localStorage['bikeservice_token' \| 'bikeservice_user']` | Auth token / user |
| `localStorage['moto_wishlist']` | Wishlist ids |
| Cloudinary folders `bikeservice/*` | All uploads |

There is also **dead code from an unrelated agriculture project**: `SparePart.farmerDetails`
(name/phone/location/email) is used as generic "seller details" in the UI, and
`server/uploads/parts/` contains a stray farming video. Don't assume it's meaningful.

---

## 1. What the product does

AutoXpress is an India-focused (INR, Razorpay, Aadhaar/PAN KYC, pincode-based
availability) car platform with **six business verticals** in one app:

1. **Buy cars** — browse/filter certified new & used car listings, enquire about one.
2. **Sell your car** — multi-step form → algorithmic instant valuation → admin reviews and offers a price.
3. **Car servicing** — pick a service type, schedule a doorstep slot, optional Razorpay advance, admin assigns a mechanic.
4. **Car rentals** — daily *or* hourly rental with security deposit, KYC upload, 3 payment plans, and **live GPS tracking** of active rentals via Socket.IO.
5. **Spare parts / accessories store** — catalog with variants and per-pincode pricing, a persisted cart, Razorpay-only checkout (cash on delivery has been withdrawn), order tracking.
6. **Admin dashboard** — one 3,451-line page with 10 tabs governing all of the above.

Three roles: `user`, `mechanic`, `admin`.

---

## 2. Stack & topology

```
client/  React 19 + Vite 5 + React Router 7 + Tailwind 3   →  deployed on Vercel (SPA rewrites)
server/  Node + Express 4 (CommonJS) + Mongoose 7           →  MongoDB Atlas
                    ├─ Razorpay   (payments)
                    ├─ Cloudinary (media, with local-disk fallback)
                    ├─ Nodemailer (OTP email)
                    └─ Socket.IO  (live rental GPS)
```

- No TypeScript, no tests, no CI, no linting on the server.
- Frontend state = React Context only (`AuthContext`, `CartContext`). **Redux Toolkit
  and react-redux are installed but completely unused** — do not add to them.
- Styling is a hybrid: Tailwind config exists, but the vast majority of the UI is
  **inline `style={{}}` objects plus `<style>` blocks with `@media` overrides** for
  mobile. Match the surrounding file's convention rather than introducing Tailwind classes.
- Maps use **Leaflet / react-leaflet**. `@react-google-maps/api` is installed but unused.

### Run it

```bash
cd server && npm install && npm run dev     # nodemon → http://localhost:5000
cd client && npm install && npm run dev     # vite    → http://localhost:5173
node server/src/seeds/seedServiceTypes.js   # seed the 9 service types
node server/src/seeds/seedCategories.js     # seed 8 part categories
```

`server/package.json` has `"seed": "node src/utils/seeder.js"` — **that file does not
exist**. Use the two scripts above instead.

---

## 3. Directory map

```
client/src/
├── api/            thin axios wrappers, one per domain
│   ├── axios.js        ← the shared instance: baseURL, JWT header, 401 redirect
│   ├── authApi.js  bikeApi.js  serviceApi.js  storeApi.js(sell+parts+orders)
│   ├── rentalApi.js  adminApi.js
├── context/
│   ├── AuthContext.jsx   user/token in localStorage + wishlist (localStorage)
│   └── CartContext.jsx   cart in memory only — lost on refresh
├── components/
│   ├── common/  Navbar (19KB)  Footer  LoadingSpinner(+PageLoader,SkeletonCard)  PincodeModal
│   ├── bikes/   BikeCard.jsx (exports CarCard)  RentalCard.jsx
│   └── parts/   PartCard.jsx
├── pages/       see route table below
│   └── admin/Dashboard.jsx   ← 3,451 lines, all 10 admin tabs in one file
├── App.jsx      router + providers + <Layout> + inline 404
├── index.css    20KB of global styles (.card-dark, .badge-*, .skeleton, etc.)
└── assets/      ~30 large hero/car images (several MB each — a build-size problem)

server/src/
├── index.js         app wiring, CORS allowlist, static /uploads, Socket.IO handlers
├── config/          db.js  cloudinary.js  razorpay.js
├── models/          12 Mongoose models (see §5)
├── controllers/     auth admin bike part rental sell service
├── routes/          one router per controller
├── middleware/      auth.js(protect)  admin.js(adminOnly,mechanicOrAdmin)  upload.js  errorHandler.js
├── services/        emailService.js  paymentService.js
├── utils/           generateToken.js  priceEstimator.js
├── seeds/           seedCategories.js  seedServiceTypes.js
└── uploads/         local-disk fallback when Cloudinary is unconfigured
```

---

## 4. Frontend routes (`client/src/App.jsx`)

All routes are wrapped in `<Layout>` (Navbar + Footer) except where noted.

| Path | Page | Notes |
|---|---|---|
| `/` | `Home.jsx` (42KB) | Hero carousel, service types, featured/bestseller cars + parts, rentals strip |
| `/login`, `/register` | `Login.jsx`, `Register.jsx` | No nav/footer. Login supports password **or** OTP |
| `/bikes` | `BuyBikes.jsx` | Car listing + filters, URL-synced via `useSearchParams` |
| `/bikes/featured`, `/bikes/bestseller` | `FeaturedBikes`, `BestsellerBikes` | |
| `/bikes/:id` | `BikeDetail.jsx` (25KB) | Gallery w/ zoom, enquiry form, wishlist |
| `/sell` | `SellBike.jsx` (26KB) | Multi-step; step gating on instant valuation |
| `/services` | `Services.jsx` (20KB) | 3-step booking + optional Razorpay advance |
| `/parts` | `SpareParts.jsx` | Catalog + category filter + pincode filter |
| `/parts/:id` | `PartDetail.jsx` (28KB) | Variants, sizes, pincode pricing, video support |
| `/featured`, `/bestseller` | `FeaturedParts`, `BestsellerParts` | Parts **and** cars on the same page |
| `/cart` | `Cart.jsx` (44KB) | Address form + Leaflet map picker + COD/Razorpay checkout |
| `/rentals` | `Rentals.jsx` | Rental car grid + filters |
| `/rentals/:id` | `RentalDetail.jsx` (47KB) | Date/time picker, KYC upload, payment-plan selection, Razorpay |
| `/my-bookings`, `/my-orders` | `MyBookings.jsx` (54KB) | Tabbed: services / sells / orders / enquiries / rentals. Tab via `?tab=` |
| `/wishlist` | `Wishlist.jsx` | Ids are untyped — tries `getPart(id)` then falls back to `getBike(id)` |
| `/profile` | `Profile.jsx` (30KB) | Details + avatar + address CRUD with Leaflet picker |
| `/contact` | `Contact.jsx` | **Form is cosmetic — it only fires a toast, nothing is sent** |
| `/about` | `About.jsx` | Static marketing |
| `/admin` | `admin/Dashboard.jsx` | `hideNav`. Guard is client-side only: `if (user.role !== 'admin') navigate('/')` |
| `*` | inline JSX | Styled 404 |

### Admin dashboard tabs (all in `pages/admin/Dashboard.jsx`)

`dashboard` (stat cards + recent services) · `live-tracking` · `users` · `bikes` (Cars CRUD)
· `rentals` (Rental car CRUD) · `rental-bookings` · `services` · `sells` · `orders`
· `parts` · `leads` (car enquiries)

Line landmarks: `UsersTab` 23, `ServicesTab` 175, `PartsTab` 527, `BikesTab` 1050,
`SellsTab` 1565, `OrdersTab` 1773, `LeadsTab` 1910, `RentalsTab` 2059,
`RentalBookingsTab` 2549, `RentalBookingDetailModal` 2735, `LiveTrackingTab` 2941,
main component ~3259.

---

## 5. Data models (`server/src/models/`)

All have `timestamps: true`.

**`User`** — `name`, `email`(unique sparse), `phone`(unique sparse), `password`(bcrypt,
hashed in a `pre('save')` hook), `role: user|admin|mechanic`, `avatar`, `addresses[]`
(label/street/city/state/pincode/lat/lng), `wishlist[]→Bike`, `isActive`, `otp`, `otpExpiry`.
Method: `matchPassword()`.

**`Bike`** (= car for sale) — `title, brand, model, year, type: new|used,
condition: excellent|good|fair|poor, price, discountedPrice, kmDriven, engineCC,
fuelType: petrol|electric|hybrid, description, images[], videos[], features[],
location{city,state,pincode}, seller→User, status: available|sold|pending|inactive,
isApproved, views, enquiries[]→User, isFeatured, bestSeller, stock,
pincodePricing[{pincode,location,size,price,originalPrice,discount,inventory}],
sellerDetails{name,phone,location,email},
specifications{power,torque,transmission,brakes,tyres,weight,fuelTank,mileage}`.

**`RentalCar`** — `title, brand, model, year, pricePerDay, pricePerHour,
rentalUnits:['day'|'hour'], securityDeposit, securityDepositRefundable,
securityDepositCompulsory, fuelType(+diesel,cng), transmission, seats, doors, color,
bodyType, registrationNumber, carNumber, rcNumber, chassisNumber, engineNumber,
insuranceValidTill, pucValidTill, airConditioning/gps/bluetooth/musicSystem/
powerWindows/powerSteering/airbags, mileage, images[], features[],
location{...,address}, dropLocation{...}, status: available|rented|maintenance|inactive,
isFeatured, min/maxRentalDays, min/maxRentalHours, views`.

**`RentalBooking`** — the most complex model. `user, rentalCar,
carSnapshot{...}` (denormalized at booking time so history survives car edits),
`pickupDate/returnDate/pickupTime/returnTime, rentalUnit, totalDays, totalHours,
pricePerDay, pricePerHour, securityDeposit, subtotal, totalAmount, pickupAddress,
driverLicense, contactPhone, fullName, notes,
kyc{aadharNumber, panNumber, aadharImage, panImage, licenseImage},
status: requested|confirmed|active|completed|cancelled, statusHistory[],
payment{ method, status: pending|advance_paid|paid|refunded,
         plan: full|advance|on_drop, advanceAmount, balanceDue, amountPaid,
         balanceCollectedAt/By/Method, razorpay* ids, paidAt },
currentLocation{lat,lng,heading,speed,updatedAt}` (overwritten in place, no history).

**`ServiceBooking`** — `user, bikeBrand/bikeModel/bikeYear` (car!), `serviceType,
serviceLabel, problemDescription, isPickupDrop, isOneHourRepair, address{...+lat/lng},
scheduledDate, scheduledTime, mechanic→User, status: requested|accepted|in_progress|
completed|cancelled, statusHistory[], estimatedCost, finalCost,
payment{method, status, transactionId, advancePaid}`.

**`SellRequest`** — `user, brand, model, year, kmDriven, variant, transmission,
fuelType, ownerNumber, registrationState, seatingCapacity, bodyType, color,
features{airbags,abs,sunroof,touchscreen,parkingcamera,alloywheels}, insuranceTill,
serviceHistory, condition, images[], askingPrice, estimatedPrice, isOneHourSell,
pickupAddress{...}, status: pending|under_review|approved|rejected|pickup_scheduled|
sold|cancelled, statusHistory[], adminNote, offeredPrice, paymentStatus`.

**`SparePart`** — `name, category, brand, description, price, discountedPrice, images[],
stock, sku, compatibleBikes[], specifications(Map), isActive, isFeatured, bestSeller,
comingSoon, itemType, subCategory, videoUrl, farmerDetails{...}(legacy seller info),
variants[{size,price,originalPrice,discount,countInStock}],
pincodePricing[{pincode,location,size,price,originalPrice,discount,inventory}],
ratings, numReviews`.

**`Order`** — `user, items[{product→SparePart,name,price,quantity,image}],
deliveryAddress{street,city,state,pincode,lat,lng}, subtotal, shippingCharge(50, free >₹500),
total, payment{method: online|cod, status, transactionId, razorpayOrderId, paidAt},
status: placed|confirmed|shipped|delivered|cancelled, statusHistory[], invoiceUrl, deliveryDate`.

**`Enquiry`** — `user, bike, message, phone, status: pending|contacted|sold|rejected`.
**`ServiceType`** — `value, label, price(String, e.g. "From ₹499"), desc, isActive, order`.
**`Category`**, **`Brand`** — `{name(unique), image}`.

---

## 6. API surface

Base: `/api`. Health: `GET /api/health`. Static uploads: `/uploads/*`.
Auth = `Authorization: Bearer <jwt>`. Response envelope is always
`{ success: boolean, ... }`; errors are `{ success:false, message }` via `errorHandler.js`.

Middleware legend: **P**=`protect` (logged in) · **A**=`adminOnly` · **M/A**=`mechanicOrAdmin`.

### `/api/auth`
| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/register` | — | name + (email or phone); returns token |
| POST | `/login` | — | email or phone + password |
| POST | `/send-otp` | — | 6-digit, 10-min expiry. **Creates a stub user if none exists.** Emails via nodemailer; SMS is NOT implemented (OTP is `console.log`ged) |
| POST | `/verify-otp` | — | returns token |
| GET | `/me` | P | populates wishlist |
| PUT | `/profile` | P | multipart, field `avatar` |
| POST/PUT/DELETE | `/address[/:addressId]` | P | address CRUD |
| POST | `/wishlist/:bikeId` | P | toggle |

### `/api/bikes` (cars for sale)
`GET /featured` · `GET /bestseller` · `GET /brands` (distinct) · `GET /my-enquiries` (P)
`GET /` — filters: `type, brand, model, minPrice, maxPrice, minYear, maxYear, minKm, maxKm,
condition, fuelType, city, search, sort(newest|oldest|price_asc|price_desc|popular),
page, limit=12, isAdmin=true`. Non-admin queries force `{isApproved:true, status:'available'}`.
`GET /:id` (increments `views`) · `POST /` (P, multipart `images` ≤10; auto-approved only if admin)
`PUT /:id` (P+A, multipart) · `DELETE /:id` (P+A) · `POST /:id/enquire` (P, upserts an `Enquiry`).

### `/api/services`
`POST /` (P) · `GET /my` (P) · `GET /` (P+A, `status,page,limit`) · `GET /:id` (P)
`PUT /:id/status` (M/A — assigns mechanic, sets costs; **auto-promotes `requested`→`accepted`
the moment a mechanic is assigned**) · `POST /:id/payment` (P, Razorpay order)
· `POST /:id/verify-payment` (P).

### `/api/sell`
`POST /estimate` (public) · `POST /` (P, multipart) · `GET /my` (P) · `GET /` (P+A)
· `GET /:id` (P) · `PUT /:id/status` (P+A, sets `offeredPrice`/`adminNote`).

### `/api/store` (parts + orders)
Parts: `GET /parts/categories | /featured | /bestseller | /upcoming | /recent | /search?keyword=`
· `GET /parts` (`category, search, minPrice, maxPrice, pincode, page, limit`)
· `GET /parts/:id` · `POST|PUT|DELETE /parts[/:id]` (P+A, multipart `images` ≤10, ≤100MB each).
**Static routes are declared before `/parts/:id` — preserve that order.**
Orders: `POST /orders` (P) · `GET /orders/my` (P) · `GET /orders` (P+A) · `GET /orders/:id` (P)
· `POST /orders/:id/payment` (P) · `POST /orders/:id/verify-payment` (P) · `PUT /orders/:id/status` (P+A).

### `/api/rentals`
Cars: `GET /cars` (`brand, transmission, fuelType, seats, minPrice, maxPrice, city, search,
sort, page, limit, isAdmin`) · `GET /cars/:id` · `POST|PUT|DELETE /cars[/:id]` (P+A, multipart).
Bookings: `POST /bookings` (P, multipart w/ KYC fields) · `POST /bookings/verify` (P)
· `POST /bookings/pay-balance/:id` (P) · `POST /bookings/verify-balance/:id` (P)
· `GET /bookings/my` (P) · `GET /bookings` (P+A, `status` accepts CSV)
· `PUT /bookings/:id/status` (P+A) · `PUT /bookings/:id/cancel` (P, owner only)
· `PUT /bookings/:id/collect-balance` (P+A)
· `GET /bookings/active-locations` (P+A) · `GET /bookings/:id/location` (P+A).
**`active-locations` must stay above `:id/location` in the router.**

### `/api/admin` (all P+A except the first)
`GET /service-types/active` — **public**, declared before `router.use(protect, adminOnly)`.
`GET /stats` · `GET /users` · `PUT /users/:id` · `PUT /bikes/:id/approve`
· `GET|POST /mechanics` · `GET|POST|DELETE /categories[/:id]` · `GET|POST|DELETE /brands-list|/brands[/:id]`
· `GET|PUT /enquiries[/:id]` · `GET|POST|PUT|DELETE /service-types[/:id]`.

---

## 7. Key flows

### Auth
JWT (`JWT_SECRET`, `JWT_EXPIRE` default `30d`) signed with `{id}`. Client stores token +
user in `localStorage` under `bikeservice_token` / `bikeservice_user`. The axios response
interceptor **hard-redirects to `/login` on any 401** and clears storage. `protect` also
rejects `isActive: false` users. `JWT_REFRESH_SECRET` exists in env but **no refresh flow
is implemented**.

### Payments (Razorpay, INR)
Uniform 2-step pattern everywhere: server creates an order (`amount*100` paise) and returns
`{order, key}` → client opens Razorpay Checkout → client posts
`razorpay_order_id/payment_id/signature` back → server verifies the HMAC-SHA256 signature of
`order_id|payment_id` with `RAZORPAY_KEY_SECRET` before mutating anything. Checkout script is
lazily injected from `https://checkout.razorpay.com/v1/checkout.js` by each page.

### Rental booking (the most intricate flow) — `rentalController.createRentalBooking`
1. Multipart body; `pickupAddress` arrives as a JSON string and is parsed.
2. **KYC hard-validated**: Aadhaar `^\d{12}$`, PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`. Images optional.
3. Car must exist and be `status: 'available'`.
4. Allowed rental units are **derived from prices** (`pricePerHour > 0` ⇒ hourly allowed) unioned with `car.rentalUnits`.
5. Duration + min/max validation, then `subtotal = units × rate`.
6. **Conflict check**: overlapping bookings block only if `confirmed`/`active`, or `requested`
   within the last **15 minutes** (stale abandoned-checkout bookings are ignored). The same
   user's own bookings never block them. Overlap is compared at date **+time** granularity.
7. Deposit included if `securityDepositCompulsory !== false`, else only if the user opted in.
   `totalAmount = subtotal + effectiveDeposit`.
8. Payment plan:
   - `full` → charge `totalAmount` online now
   - `advance` → charge `securityDeposit`, or 25% of total if there is no deposit; rest is `balanceDue`
   - `on_drop` → method flips to `cod`, nothing charged now
9. If anything is charged now, a Razorpay order is created and returned with the booking.
10. `/bookings/verify` sets `status: confirmed` and `payment.status` to `paid` or `advance_paid`.
11. Balance is settled either online (`pay-balance` → `verify-balance`) or by an admin marking
    cash/upi/card via `collect-balance`.
12. `PUT /bookings/:id/status`: `active` sets the car to `rented`, **any other status sets it back
    to `available`**. Completing a booking with `balanceDue > 0` is rejected.

### Live GPS tracking (Socket.IO)
Server (`server/src/index.js`) with `cors.origin: '*'`. Events:
- `update_location` `{bookingId, lat, lng, heading, speed}` → overwrites `RentalBooking.currentLocation`
  (no history) and broadcasts `location_update` to room `booking_<id>`.
- `admin_watch_booking` `<bookingId>` → join that room.
- `admin_watch_all` → join rooms for every `status: 'active'` booking.
- `stop_tracking`, `disconnect` → logging only.
The emitting client is expected to be **a mobile app that does not exist in this repo**.
Admin side is `LiveTrackingTab` (Dashboard ~line 2941), which connects to
`VITE_API_URL` minus a trailing `/api`.

### Sell valuation — `server/src/utils/priceEstimator.js`
Pure heuristic, no data source. Base by brand tier (₹35L luxury / ₹12L / ₹8L / ₹5L default)
× `0.88^age` − `₹3/km` (capped at 40% of base) × transmission (auto 1.15) × fuel
(EV 1.25 / hybrid 1.2 / diesel 1.1 / petrol 1.0 / CNG 0.95) × owner count (1st 1.0 → 4th+ 0.6),
floored at ₹1,00,000. Called on both `/sell/estimate` and `/sell` create.

### Parts checkout — `partController.placeOrder`
Server re-reads each `SparePart`, rejects if `stock < quantity`, recomputes the unit price
via `resolveUnitPrice()` — the delivery pincode's `pincodePricing` entry when there is one,
otherwise `discountedPrice || price`, so the amount charged matches the amount displayed —
**decrements stock immediately**, and computes `shipping = subtotal > 500 ? 0 : 50`.
The client sends only `{product, quantity}`; prices in the request body are ignored.
`payment.method` must be `online` (COD is rejected). If the customer abandons or fails the
Razorpay step, `Cart.jsx` calls `PUT /store/orders/:id/cancel`, which restores the stock.
After a successful payment the customer is sent to `/my-orders?tab=orders`, which opens the
dashboard's **Parts Orders** tab on the order they just paid for.

### Pincode availability (a cross-cutting frontend concept)
Selected pincode lives in `localStorage['selectedPincode']`; changes are broadcast with a
custom DOM event `window.dispatchEvent(new Event('pincode-updated'))` that many components
subscribe to. Backend `pincodeFilter()` matches products whose `pincodePricing` contains the
pincode **or that have no `pincodePricing` at all** (= available everywhere). `PincodeModal`
auto-display is currently commented out; default fallback pincode is `124001`.

### Media uploads — `server/src/middleware/upload.js`
Cloudinary if `CLOUDINARY_API_KEY` is set and not the literal `'your_api_key'`, otherwise
multer disk storage under `server/uploads/<folder>/`. Folders: `bikes`, `avatars`, `parts`,
`categories`, `rental-kyc`. Limits: bikes 50MB, parts 100MB, avatar 5MB, KYC 10MB.
Accepted: jpeg/png/webp/mp4/mov/webm (+pdf for KYC).
Bike/rental controllers store `file.path` **verbatim**; part/category controllers pass it
through a `toUrl()` helper that rewrites local paths to `/uploads/...`. This inconsistency
is real — local-disk bike images may come back with an absolute filesystem path.

### Multipart JSON convention
Nested objects (`location`, `specifications`, `features`, `pincodePricing`, `sellerDetails`,
`farmerDetails`, `pickupAddress`, `dropLocation`) are sent as **JSON strings** inside
form-data and `JSON.parse`d server-side. `updateBike` / `updatePart` implement a
**field-preserving merge**: any field arriving as `''`/`'undefined'`/`'null'`/`undefined`
(or `0` for prices) falls back to the stored value, and `existingImages[]` from the client
is concatenated with newly uploaded files to form the new `images` array.
`updateRentalCar` deliberately uses `$set` so that `false` booleans actually persist.

---

## 8. Environment variables

`server/.env`
```
PORT=5000
NODE_ENV=development
MONGO_URI=<mongodb atlas uri>
JWT_SECRET=...            JWT_EXPIRE=30d          JWT_REFRESH_SECRET=... (unused)
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=...       RAZORPAY_KEY_SECRET=...
CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=...  CLOUDINARY_API_SECRET=...
SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=...  SMTP_PASS=...
FROM_EMAIL=...            FROM_NAME=AutoXpress
```

`client/.env`
```
VITE_API_URL=http://localhost:5000/api      # REQUIRED — axios has no fallback
VITE_RAZORPAY_KEY_ID=rzp_test_...           # optional; server also returns the key
```

CORS allowlist (`server/src/index.js`): `process.env.CLIENT_URL`, `localhost:5173`,
`localhost:5174`, `https://autoexpress.avanienterprises.in`. Requests with no `Origin` pass.

**Bootstrapping an admin:** register normally, then in Mongo
`db.users.updateOne({email:"..."},{$set:{role:"admin"}})`.

---

## 9. Known issues, traps and stale artifacts

Read this before "fixing" something that looks broken — most of it is known.

**Security**
1. `server/.env.example` is committed **containing what appear to be real live credentials**
   (Mongo Atlas URI with password, Razorpay keys, a Gmail app password, Cloudinary secret).
   These should be rotated and the file replaced with placeholders. Do not copy them anywhere.
2. The `/admin` route guard is **client-side only**. Security rests entirely on `adminOnly`
   at the API layer — verify any new admin endpoint has it.
3. `POST /api/bikes` is open to any logged-in user (auto-approved only for admins), but the
   UI never exposes it.
4. `createMechanic` defaults a new mechanic's password to their **phone number**.
5. Rental KYC (Aadhaar/PAN numbers and document images) is stored unencrypted and returned
   in admin booking payloads.

**Broken / incomplete**
6. **Email is misconfigured**: `emailService.js` reads `SMTP_HOST/SMTP_USER/SMTP_PASS`, but
   `.env.example` defines `MAIL_HOST/EMAIL_USER/EMAIL_PASS`. OTP email will fail unless the
   env names are reconciled.
7. **Phone OTP has no SMS provider** — the code just `console.log`s the OTP (there's a
   `// integrate Twilio here` comment).
8. `POST /auth/send-otp` **creates a user record for any unknown email/phone** — an unauthenticated
   account-creation vector and a source of junk `name: 'User'` records.
9. The `/contact` form does not submit anywhere; it only shows a success toast.
10. `npm run seed` on the server points at a non-existent `src/utils/seeder.js`.
11. Socket fallback URL in `Dashboard.jsx` is `http://localhost:5003` while the server runs on
    `5000` — only hit when `VITE_API_URL` is unset.
12. Wishlist has **two competing sources of truth**: `User.wishlist` on the server
    (`POST /auth/wishlist/:id`) and `localStorage['moto_wishlist']` in `AuthContext`. UI
    components read the local one. `Wishlist.jsx` doesn't know whether an id is a part or a
    car, so it probes both endpoints.
13. ~~Cart is in-memory only — a page refresh empties it.~~ **Fixed**: the parts cart is
    persisted to `localStorage['gkmotors_parts_cart']` and synchronised across tabs, the
    same way the service cart already was.
14. `placeOrder` now honours `pincodePricing` for the delivery pincode (`resolveUnitPrice`).
    **`variants` / per-size pricing is still not applied server-side** — a size-specific
    price shown on `PartDetail` is not what gets charged. Still open.
15. Stock is decremented at order creation, and never restored on cancellation or payment failure.
16. `getRentalCars` includes `status: 'rented'` cars in the public list; only `createRentalBooking`
    rejects them, and it does so with a generic error.
17. `GET /api/bikes/:id` writes to the DB (`views += 1`) on every read.
18. `getFeaturedParts` / `getBestsellerParts` / `searchParts` return **unpaginated** result sets.

**Stale / dead**
19. Root `README.md` describes "MotoXpress", a *bike* platform, with an outdated endpoint table
    and **no mention of rentals or live tracking**. This file (AGENTS.md) supersedes it.
20. `SparePart.farmerDetails` and the farming video in `server/uploads/parts/` are leftovers
    from an unrelated project.
21. `BIKE_BRANDS` in `Dashboard.jsx` (line 1049) still lists motorcycle makes (Honda, Bajaj,
    TVS, Hero, Royal Enfield…) while `BuyBikes.jsx`/`SellBike.jsx` list car makes.
22. Redux Toolkit, react-redux, `@react-google-maps/api`, `swiper`, `date-fns` and `framer-motion`
    are installed but barely or never used.
23. Tailwind's palette (`primary #111111`, `secondary #E53935` red) reflects the old dark bike
    theme; the current UI is a **light theme with navy `#1E3A8A` / `#0F172A` accents** applied
    through inline styles. Trust the inline styles, not `tailwind.config.js`.
24. Loose image files sit in the repo root (`1.png`, `car-tyres.jpg`, `cf3591…jpg`, `images.png`)
    and `server/uploads/` is committed, including a 30MB video.

---

## 10. Conventions to follow

- **Backend**: CommonJS `require`. Every controller is wrapped in `express-async-handler`;
  signal errors with `res.status(4xx); throw new Error('message')` and let `errorHandler`
  format them. Always respond `{ success: true, ... }`. Keys are singular for one resource
  (`{bike}`, `{order}`) and plural for lists (`{bikes, total, page, pages}`).
- Any status change on a booking/order/sell request should push to `statusHistory`
  (`{status, note, updatedAt}`) — every existing flow does.
- **Express route ordering matters**: static segments must be registered before `:id` params
  (already noted for `/parts/*`, `/rentals/bookings/active-locations`, `/admin/service-types/active`).
- **Frontend**: functional components with hooks, default exports. API calls go through the
  `client/src/api/*.js` wrappers, never raw axios (except `import API from '../api/axios'`
  for one-offs in the Dashboard). Use `react-hot-toast` for all user feedback and
  `LoadingSpinner` / `PageLoader` / `SkeletonCard` for loading states.
- Icons come from `lucide-react` (with `react-icons/fa` used for social links in the Footer).
- Prices are rendered with `toLocaleString('en-IN')` and a ₹ symbol.
- Currency is INR throughout; Razorpay amounts are always integers in paise.
- Match the file you're editing: these are large, self-contained page components with inline
  styles — don't refactor one into a different paradigm as a side effect of a small change.

## 11. Suggested first moves for an agent

- Need to change how a car is listed/filtered → `server/src/controllers/bikeController.js`
  + `client/src/pages/BuyBikes.jsx`.
- Need to change rental pricing, deposits, or payment plans → `rentalController.createRentalBooking`
  + `client/src/pages/RentalDetail.jsx`.
- Need to change the admin UI → find the tab component by the line landmarks in §4; the file
  is huge, so edit surgically rather than reading it end to end.
- Need to add an API endpoint → model → controller → route → `client/src/api/*.js` wrapper → page.
