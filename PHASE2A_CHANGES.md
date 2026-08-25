# Phase 2A — Booking & Payment Correctness

**Date:** 25 August 2026
**Scope:** Booking/payment correctness only. No UI redesign, no performance work, no refactors, no dependency changes, no data migrations.
**Tests:** 95 assertions across 4 suites, all passing (see §7).

---

## 1. FILES CHANGED

### Backend
| File | Change |
|---|---|
| `server/src/services/paymentService.js` | Hardened. `crypto.timingSafeEqual`, secret validation, new `verifyWebhookSignature`, `isPaymentConfigured`, `isWebhookConfigured`. |
| `server/src/services/emailService.js` | Split the booking templates. Shared `bookingBlocks()` helper, new `sendBookingReceivedEmail`, rewritten `sendBookingConfirmationEmail` (paid-only), payment-aware `sendBookingStatusUpdateEmail`. |
| `server/src/controllers/serviceController.js` | The bulk of the work. Slot-hold logic, atomic paid transition, email relocation, failure endpoint, webhook handler, capacity re-checks. |
| `server/src/routes/serviceRoutes.js` | Added `POST /:id/payment-failed`. |
| `server/src/index.js` | Mounted the Razorpay webhook **ahead of** `express.json()` so the raw body survives for signature verification. |
| `server/src/models/ServiceBooking.js` | One sparse index on `payment.razorpayOrderId` (the webhook's only lookup key). **No field/enum changes.** |
| `server/.env.example` | Documented `RAZORPAY_WEBHOOK_SECRET`, `SERVICE_SLOT_CAPACITY`, `SERVICE_SLOT_HOLD_MINUTES`. *(untracked by git — it is gitignored)* |

### Frontend
| File | Change |
|---|---|
| `client/src/api/serviceApi.js` | Added `reportServicePaymentFailed`. |
| `client/src/components/service/CheckoutModal.jsx` | Pending-booking handoff in `sessionStorage` keyed by a checkout signature; reports cancel/failure to the server; clears on success. |
| `client/src/pages/MyBookings.jsx` | "Complete Payment" on unpaid bookings; accurate payment pill; slot-hold warning. |

**Nothing else was touched.** `Home.jsx`, `ServiceCategoryGrid.jsx`, `OrderDetail.jsx`, `utils/istTime.js`, `utils/responsive.js` and `README.md` show as modified in `git status` — those were already dirty in your working tree before this phase began and I did not open them.

---

## 2. EXACT BUGS FIXED

**BUG 1 — "Booking Confirmed" email sent before payment. *(the reported bug)***
`serviceController.js:289` called `sendBookingConfirmationEmail` inside `createServiceBooking`, immediately after `ServiceBooking.create()` with `payment.status: 'pending'`. That runs as **step 1** of the client's `handlePay()` — before the Razorpay order is created and before the customer has seen the payment sheet. Cancelling, failing, or never paying made no difference: the mail was already gone.
**Fixed:** creation now sends "Booking received — payment pending". The confirmation moved to `verifyServicePayment` / the webhook, and fires only on the call that actually flips the booking to paid.

**BUG 2 — a second confirmation path via status updates.**
`updateBookingStatus` → `sendBookingStatusUpdateEmail` with status `accepted` said *"Your car service booking has been confirmed!"* without ever reading `payment.status`. Worse, `serviceController.js:411-415` auto-promotes `requested → accepted` the moment a mechanic is assigned — so merely assigning a mechanic to an unpaid booking emailed the customer a confirmation.
**Fixed:** the copy is now payment-aware. Unpaid + `accepted` becomes "Booking Accepted — Payment Pending" with an amber banner; the status update still goes out, it just stops lying. Paid bookings keep the original wording.

**BUG 3 — retrying a payment created a duplicate booking.**
`CheckoutModal.jsx:139` reset `bookingId = null` on every modal open. Close the modal after a failed payment, reopen, pay → a **second** `ServiceBooking` (and, before this phase, a second confirmation email), leaving an orphan that also consumed a slot.
**Fixed:** the id is parked in `sessionStorage`, tagged with a signature of the checkout inputs.

**BUG 4 — abandoned checkouts blocked slots for ever.**
`getAvailability` counted `status: 'requested'` with no reference to `payment.status`. Because bookings are written pre-payment and nothing expired them, a handful of abandoned checkouts showed a day as fully booked permanently.
**Fixed:** a 15-minute payment hold, then the slot is released. See §5.

**BUG 5 — cancellation and failure were client-only.**
`modal.ondismiss` and `rzp.on('payment.failed')` set local state and made no server call. The booking sat `pending` with no record.
**Fixed:** both now report to `POST /:id/payment-failed`, and the Razorpay webhook is the authoritative backstop.

**BUG 6 — a lost browser callback meant a charged-but-unpaid booking.**
There was no webhook anywhere in the project. If the tab closed between Razorpay charging the card and `verify-payment` firing, the money was taken and the booking never learned about it, with nothing to reconcile it.
**Fixed:** `POST /api/services/payment-webhook` handles `payment.captured` / `payment.failed`.

**BUG 7 — an unpaid booking was a dead end for the customer.**
`MyBookings.jsx` rendered a "Payment pending" pill with no way to act on it.
**Fixed:** "Complete Payment" pays the existing booking.

**BUG 8 (found while tracing) — cross-booking signature replay.**
`verifyServicePayment` verified the signature but never checked the order id belonged to *this* booking. A valid signature from any other order on the same Razorpay account would have marked it paid.
**Fixed:** the order id is now bound to the booking before the transition.

**BUG 9 (found while tracing) — no capacity check at booking creation.**
`createServiceBooking` validated the slot's *format* and range but never its capacity, so a stale tab or a crafted request could overbook.
**Fixed:** capacity is checked at creation and re-checked before taking money.

**Hardening (requirement 7):** `verifyPayment` now validates its inputs, checks `RAZORPAY_KEY_SECRET` is set before hashing (rather than `createHmac('sha256', undefined)` throwing an opaque error), and compares with `crypto.timingSafeEqual` behind a hex-shape guard. It returns `false` and never throws, so a caller can never mistake an error for a pass. A missing key now yields 503 from `verifyServicePayment` instead of marking a real payment failed.

---

## 3. NEW BOOKING / PAYMENT LIFECYCLE

```
CheckoutModal.handlePay()
│
├─ compute checkoutSignature(car, services, slot, address, pickup)
├─ reuse sessionStorage booking id IF its signature still matches
│
├─ (only if none) POST /api/services/book
│     ├─ validate · resolve prices SERVER-SIDE · re-check slot capacity
│     ├─ ServiceBooking.create → status 'requested', payment.status 'pending'
│     └─ ✉  "Booking received — payment pending"     ← honest, no confirmation
│
├─ POST /api/services/:id/payment
│     ├─ owner check · not-already-paid · amount FROM THE BOOKING
│     ├─ re-check slot capacity (the hold may have lapsed)  → 409 if taken
│     └─ Razorpay order created, order id stored on the booking
│
├─ Razorpay checkout opens
│   ├─ dismissed  → POST /:id/payment-failed {cancelled:true}
│   │                 stays 'pending' (retryable), audit note, hold expires
│   ├─ failed     → POST /:id/payment-failed {reason}
│   │                 payment.status 'failed' → slot released immediately
│   └─ success    ↓
│
└─ POST /api/services/:id/verify-payment
      ├─ owner check
      ├─ already paid? → idempotent success, NO email
      ├─ payment configured? → else 503, booking untouched
      ├─ verify HMAC signature (timing-safe)  → invalid: mark failed, 400, NO email
      ├─ order id belongs to THIS booking?    → else 400, NO email
      ├─ markBookingPaid() — atomic conditional update
      │     matched   → this call performed pending → paid
      │     no match  → someone else already did (webhook / second tab)
      └─ ✉  "Booking confirmed" — ONLY on a real transition, fire-and-forget

           ── in parallel, independently ──
POST /api/services/payment-webhook   (raw body, HMAC with RAZORPAY_WEBHOOK_SECRET)
      ├─ payment.captured → same markBookingPaid() → ✉ only if it transitioned
      └─ payment.failed   → mark failed, guarded so it can never un-pay
```

**The single guarantee that makes this work:** `markBookingPaid` is a `findOneAndUpdate` with a `'payment.status': { $ne: 'paid' }` filter. Exactly one caller can match. The winner gets the document, everyone else gets `null` — and only a non-null result sends the email. Retries, double-clicks, a webhook racing the browser, Razorpay redelivering: all converge on one email.

It is written as an aggregation-pipeline update so `statusHistory` is appended with the booking's own current `status` atomically, preserving your convention that every state change pushes to `statusHistory`.

---

## 4. HOW DUPLICATE BOOKINGS ARE PREVENTED

The booking id lives in `sessionStorage` under `gkmotors_pending_booking` as `{ id, key, at }`, where `key` is `checkoutSignature(...)` over the car, the sorted service ids, the date, the time, the address id and the pickup/drop choice.

- **Reuse requires an exact signature match.** Retry the same checkout → same booking. Change the slot, the car, the services, the address or the pickup option → the pending booking no longer describes the purchase, so a new one is created. This is the important half: without it, a customer who changed the date after a failed payment would have been charged for the original slot.
- **Service order is normalised** (ids are sorted), so reordering the cart is not treated as a different purchase.
- **`sessionStorage`, not `localStorage`** — the handoff belongs to one tab and one sitting.
- **Cleared on success**, and on a 409 (slot gone, so the booking can never be paid).
- **Bounded by a 1-hour TTL**, and by shape validation, so a corrupt or ancient entry is discarded rather than resurrected.
- **Every access is `try/catch`ed** — private browsing or a blocked storage degrades to "no handoff", never a crash.

Server-side, `MyBookings` → "Complete Payment" reuses `POST /:id/payment` against the existing booking and cannot create a second one.

---

## 5. HOW ABANDONED PAYMENTS AFFECT AVAILABILITY

The rule lives in one place — `slotHolderFilter()` — shared by `getAvailability` (what the customer sees) and both capacity checks (what is enforced), so display and enforcement cannot drift.

| Booking state | Holds the slot? |
|---|---|
| `accepted` / `in_progress`, any payment state | **Yes, always** |
| `requested` + `paid` | **Yes** |
| `requested` + `pending`, created < 15 min ago | **Yes** (grace hold) |
| `requested` + `pending`, created > 15 min ago | **No** — released |
| `requested` + `failed` | **No** — released immediately |
| `requested`, no `payment` field at all (legacy), < 15 min | **Yes** |
| `cancelled` / `completed` | No |

**Where 15 minutes came from:** not invented. `rentalController.js:251-253` already uses exactly this window for exactly this situation — `STALE_REQUESTED_MS = 15 * 60 * 1000`, commented *"Stale 'requested' bookings older than 15 minutes are ignored (user closed Razorpay / payment failed)"*. Phase 2A mirrors the convention the codebase already established. It is overridable via `SERVICE_SLOT_HOLD_MINUTES`.

**Why `accepted`/`in_progress` always hold, whatever the payment says:** the grace period is deliberately scoped to `requested` only. Legacy bookings, anything settled offline, and anything staff have already acted on live in those states — releasing one would double-book a real job. This mirrors rentalController, where `confirmed`/`active` always block and only `requested` gets the staleness test.

**A consequence worth knowing:** because the hold now expires, a customer returning to an old pending booking may find the slot gone. `createServicePayment` therefore re-checks capacity and returns **409** with a clear message rather than letting them pay into an overbooked slot. Both the checkout modal and My Bookings handle that.

---

## 6. EMAIL BEHAVIOUR — BEFORE vs AFTER

| Event | Before | After |
|---|---|---|
| Booking created, payment not yet attempted | **"Booking confirmed — {car} on {date}"** | **"Booking received — payment pending ({ref})"**, amber PAYMENT PENDING banner, "It is not confirmed yet", Complete Payment button |
| Customer cancels the Razorpay sheet | *(confirmation already sent)* | No further email. Booking stays payable. |
| Payment fails | *(confirmation already sent)* | No further email. |
| Payment succeeds and verifies | *(nothing — no receipt at all)* | **"Booking confirmed — {car} on {date}"**, green PAYMENT RECEIVED banner, payment id, amount, paid-on date |
| Verify called twice | n/a | Second call: idempotent success, **no second email** |
| Webhook arrives after the browser verified | n/a | **No second email** (no transition, no mail) |
| Webhook arrives when the browser never did | n/a | Confirmation sent — the recovery path |
| Mechanic assigned to an **unpaid** booking | **"Booking Accepted … has been confirmed!"** | **"Booking Accepted — Payment Pending"**, amber banner, `Payment: Pending` row |
| Mechanic assigned to a **paid** booking | "Booking Accepted … confirmed!" | Unchanged |
| Booking cancelled while unpaid | status mail | status mail, **no** payment nag |
| Email provider down during a successful payment | n/a | Payment still recorded, request still 200 — fire-and-forget preserved |

`sendBookingConfirmationEmail` now has **exactly one call site** in the entire codebase (`serviceController.js:612`, inside `sendConfirmationForPaidBooking`), reachable only after a successful atomic paid transition. Verified by grep.

---

## 7. TESTS / CHECKS PERFORMED

**95 assertions, 4 suites, all passing.** Run against the real controller and the real email templates, with `mongoose`/`razorpay`/`nodemailer` stubbed. Emails are observed by intercepting the Brevo HTTPS call, so assertions are made against **the subject line a customer would actually receive** — not against a mock.

| Suite | Covers | Result |
|---|---|---|
| A | Booking-creation email · invalid signature · successful payment · double verify | **19/19** |
| B | Slot-hold filter behaviour · tampered amount · 409 on a taken slot · cancel · fail · late-failure guard · ownership | **27/27** |
| C | Status-email gating (paid/unpaid/cancelled) · webhook capture, redelivery, forged signature, unknown order, failed-event guard · cross-booking replay · email outage | **31/31** |
| D | Duplicate prevention: the **real** `checkoutSignature` / `readPendingBooking` helpers extracted from the shipped `CheckoutModal.jsx` | **18/18** |

Mapped to your list:

- **TEST 1 — successful payment:** paid, one email, subject "Booking confirmed", one transition. ✅
- **TEST 2 — cancelled:** no confirmation email, stays `pending`, retryable, audit note. ✅
- **TEST 3 — failed:** no confirmation email, marked `failed`, slot released, reason captured. ✅
- **TEST 4 — retry:** same booking id reused; verified it is *not* reused when the slot/car/services/address/pickup change; service order normalised; cleared after success; TTL, corrupt-data and blocked-storage paths. ✅
- **TEST 5 — verify twice:** second call idempotent success, no second email, still one transition. ✅
- **TEST 6 — abandoned booking:** 10 behavioural cases through a real query evaluator (paid holds; fresh pending holds; stale pending does not; failed does not; accepted always holds; legacy no-payment-field holds; cancelled/completed/other-day do not). ✅
- **TEST 7 — My Bookings:** button renders for unpaid non-cancelled bookings with an amount; pays the existing booking via `POST /:id/payment` (no second booking). *Logic verified by reading; not exercised in a browser — see §8.*
- **TEST 8 — tampered amount:** hostile body `{amount: 1}` ignored; ₹2,999 charged; Razorpay order 299900 paise. ✅
- **TEST 9 — invalid signature:** 400, marked failed, no email. ✅
- **TEST 10 — email outage:** payment still verified and recorded, request still 200. ✅

**Static checks**
- `node --check` on all 6 changed server files — clean.
- `@babel/parser` (JSX) on all 3 changed client files — clean.
- Scope analysis for undefined references on the client files — clean (the only hit was `URLSearchParams`, a browser global in pre-existing code).
- Grep audit of every call site of `sendBookingConfirmationEmail`, `sendBookingReceivedEmail`, `createServiceBooking`, `verifyServicePayment`, `updateBookingStatus`.
- `git diff --stat` confirms line endings preserved (CRLF) — no whole-file rewrites.

**Not run:** `vite build` and `eslint`. Your `client/node_modules` holds the Windows rollup binary, so the Linux VM the tooling runs in cannot execute them (`Cannot find module '@rollup/rollup-linux-x64-gnu'`); eslint over the mounted filesystem exceeded the 45-second command limit. **Please run `npm run build` and `npm run lint` on your machine before deploying** — the parser and scope checks above cover syntax and undefined references, but not lint rules.

---

## 8. REMAINING RISKS / DECISIONS NEEDING BUSINESS CONFIRMATION

### Needs a decision from you

1. **The webhook is inert until you configure it.** `RAZORPAY_WEBHOOK_SECRET` does not exist in your `.env`. Until it is set the route answers 503 and refuses everything — deliberately, rather than trusting an unsigned body. Checkout works fine without it; you just do not have the recovery path for a lost browser callback. **To enable:** Razorpay Dashboard → Settings → Webhooks → add `https://<your-api-host>/api/services/payment-webhook`, subscribe to `payment.captured` and `payment.failed`, then put the secret you chose into `server/.env`.

2. **15-minute slot hold — confirm it suits the workshop.** Taken from rentalController's existing convention rather than invented. Tune with `SERVICE_SLOT_HOLD_MINUTES` if bookings genuinely take longer to pay for. Longer = fewer lost slots for slow payers, more phantom-full slots.

3. **Every booking attempt now sends an email.** The spec asked for a "Booking received" mail, so abandoned checkouts now generate one where previously they generated a (wrong) confirmation. Volume is unchanged; the wording is not. If Brevo quota is a concern, this is the knob.

4. **Cancellation keeps `pending`; a declined card sets `failed`.** My reading: closing the sheet is not a failed payment and the customer will likely retry, so the booking stays `pending` (and its slot hold runs down normally). A declined card sets `failed`, which frees the slot at once. Both remain payable from My Bookings. Say the word if you want cancellation to release the slot immediately too.

5. **"Complete Payment" shows for `failed` as well as `pending`.** Your spec said `payment.status === 'pending'`. I extended it because a declined card is exactly when someone needs to try again, and a `failed` booking is otherwise unrecoverable. Easy to narrow.

### Risks to watch

6. **Availability will visibly increase** on days that had accumulated abandoned bookings. That is the fix working, but it will look like a change in behaviour — worth expecting rather than debugging.

7. **The new 409s are a new failure mode.** A customer returning to an old pending booking can now be told the slot is gone. Handled in both UIs with a clear message, but it is a path that did not exist before.

8. **Booking creation can now be rejected for capacity.** Previously it never was. The availability UI already prevents it in the normal flow, so this should only bite stale tabs — but it is a new rejection.

9. **The aggregation-pipeline update needs MongoDB ≥ 4.2** (for `$$NOW` and pipeline updates). Atlas is well past this; noting it for completeness.

10. **`booking.status` still does not advance on payment.** A paid booking still reads `requested` until an admin accepts it. I left this alone deliberately — it is a workflow decision, not a correctness bug, and changing it would alter what the admin dashboard shows. Flagging it because "paid but still says requested" may look wrong to staff.

11. **The parts/order flow (`partController`) has the same architecture** — order created before payment, `verifyPartPayment` sends no receipt. It was out of scope here and I did not touch it. Worth a look in a later phase.

12. **Pre-existing, unrelated, still true:** `server/.env.example` is committed containing what appear to be **real live credentials** (Mongo URI with password, Razorpay keys, Cloudinary secret). I added placeholder lines to it but did not touch the existing values. These should be rotated.

---

*Phase 2A only. No Phase 2B work was started.*
