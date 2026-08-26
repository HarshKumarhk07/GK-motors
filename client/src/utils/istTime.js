/**
 * Clock helpers pinned to Indian Standard Time.
 *
 * The workshop is in Rohtak and every rule about "today", "already passed" and
 * the 9-to-6 pickup window is a statement about local time there. `new Date()`
 * reports whatever timezone the process happens to run in — UTC on Render —
 * which is 5h30m behind IST. Left alone that means at 20:00 in Rohtak the
 * server still believes it is 14:30 and keeps offering same-day slots that
 * ended hours ago.
 *
 * Intl carries the offset (and would carry DST, though India has none), so
 * there is no hardcoded +5:30 anywhere here.
 */
const IST = 'Asia/Kolkata';

const FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/**
 * The current moment in IST.
 * @returns {{date: string, hour: number, minute: number, minutes: number}}
 *   date is YYYY-MM-DD; minutes is minutes since midnight, for comparing
 *   against a slot without juggling hours and minutes separately.
 */
const istNow = (at = new Date()) => {
  const parts = Object.fromEntries(
    FORMATTER.formatToParts(at).map((p) => [p.type, p.value])
  );
  // Some engines render midnight as hour "24" under hour12:false.
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
};

/** Minutes since midnight for an "HH:MM" slot, or null if unparseable. */
const slotMinutes = (time) => {
  if (typeof time !== 'string') return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/** YYYY-MM-DD, `days` after the given IST date. */
const addIstDays = (isoDate, days) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Noon UTC keeps the arithmetic clear of any date rollover at the edges.
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};


/**
 * "Mon, 25 Aug 2026" from a YYYY-MM-DD string, for showing a chosen date as
 * words instead of the raw ISO value the date input holds.
 */
const formatIstDate = (isoDate, opts = {}) => {
  if (!isoDate) return '';
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoDate;
  // Noon UTC so the rendered day cannot slip either side of midnight.
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', {
    weekday: opts.long ? 'long' : 'short',
    day: 'numeric',
    month: opts.long ? 'long' : 'short',
    year: 'numeric',
    timeZone: IST,
  });
};

/* ── The pickup window ─────────────────────────────────────────────────────
   Mirrors CheckoutModal's LAST_BOOKABLE_HOUR and the 9am open. A collection
   offered at 19:30 that nobody is there to make is worse than offering
   tomorrow morning, so the last pickup is well before the shutters close.

   Sunday opens later, matching BIZ.hoursSunday. */
const PICKUP_OPEN_HOUR = 9;
const PICKUP_OPEN_HOUR_SUNDAY = 10;
const PICKUP_LAST_HOUR = 18;

/** 0 = Sunday. Derived from the IST date string, not the device's clock. */
const istWeekday = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Noon UTC keeps this clear of any rollover at the date's edges.
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
};

const openHourFor = (isoDate) =>
  (istWeekday(isoDate) === 0 ? PICKUP_OPEN_HOUR_SUNDAY : PICKUP_OPEN_HOUR);

const label = (mins) => {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  return m === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/**
 * The next collection slot the workshop could realistically make.
 *
 * The rule, in order:
 *   1. Never sooner than 30 minutes from now — a driver has to actually get
 *      there.
 *   2. Rounded UP to the next whole hour, so the site never offers "3:47 PM".
 *      At 9:00 that gives 10:00; at 10:30 it gives 11:00.
 *   3. If that lands before opening, it becomes opening time today.
 *   4. If it lands after the last pickup hour — which is most of the evening
 *      and all night — it becomes opening time TOMORROW. This is the case
 *      that mattered: at 3am the page was cheerfully offering a pickup
 *      "today, 4:00 PM" with no idea the workshop was shut.
 *
 * Judged entirely in IST, so a phone whose clock is set to another timezone
 * still sees Rohtak's real availability.
 *
 * @returns {{when: string, time: string, tomorrow: boolean, readyBy: string}}
 */
const nextPickupSlot = (at = new Date(), serviceHours = 4) => {
  const now = istNow(at);

  const todayOpen = openHourFor(now.date) * 60;
  const lastPickup = PICKUP_LAST_HOUR * 60;

  // Half an hour of grace, then up to the next whole hour.
  let mins = Math.ceil((now.minutes + 30) / 60) * 60;
  let tomorrow = false;

  if (mins < todayOpen) {
    mins = todayOpen;
  } else if (mins > lastPickup) {
    tomorrow = true;
    mins = openHourFor(addIstDays(now.date, 1)) * 60;
  }

  /* When the car comes back. Capped at the last pickup hour: if the work would
     run past that, it is a next-day return and saying so is better than
     implying an 8pm handover. */
  const readyMins = mins + serviceHours * 60;
  const readyBy = readyMins <= lastPickup
    ? `Ready by about ${label(readyMins)}`
    : 'Back with you the next morning';

  return {
    time: label(mins),
    tomorrow,
    when: tomorrow ? `tomorrow, ${label(mins)}` : `today, ${label(mins)}`,
    readyBy,
  };
};

export {
  IST, istNow, slotMinutes, addIstDays, formatIstDate,
  nextPickupSlot, PICKUP_OPEN_HOUR, PICKUP_LAST_HOUR,
};
