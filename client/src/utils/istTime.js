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

export { IST, istNow, slotMinutes, addIstDays, formatIstDate };
