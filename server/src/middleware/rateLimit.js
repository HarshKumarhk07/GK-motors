/**
 * In-memory rate limiter.
 *
 * Deliberately dependency-free: express-rate-limit would be the usual choice
 * but the registry is not reachable from this environment. The trade-off is
 * that counters live in process memory, so they reset on restart and are not
 * shared across instances. For a single-instance deployment that is enough to
 * stop password guessing and OTP flooding. Move to a Redis-backed limiter if
 * you scale horizontally.
 */

const buckets = new Map();

// Drop expired buckets every 10 minutes so memory cannot grow without bound.
const SWEEP_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, SWEEP_MS).unref?.();

const clientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.socket?.remoteAddress ||
  'unknown';

/**
 * @param {object}   opts
 * @param {number}   opts.windowMs  how long a window lasts
 * @param {number}   opts.max       requests allowed per window
 * @param {string}   opts.name      bucket namespace, so limiters do not collide
 * @param {string}   opts.message   response shown when the limit is hit
 * @param {function} opts.keyBy     extra key material, e.g. the submitted email
 */
const rateLimit = ({ windowMs, max, name = 'default', message, keyBy }) => (req, res, next) => {
  const extra = typeof keyBy === 'function' ? keyBy(req) : '';
  const key = `${name}:${clientIp(req)}:${extra || ''}`;
  const now = Date.now();

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;

  const remaining = Math.max(0, max - entry.count);
  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      success: false,
      message: message || `Too many requests. Please try again in ${retryAfter} second(s).`,
    });
  }
  return next();
};

/** Clear a bucket after a success, so a valid login does not count against the user. */
const clearRateLimit = (name, req, extra = '') => {
  buckets.delete(`${name}:${clientIp(req)}:${extra || ''}`);
};

// Password guessing: keyed by IP *and* the account being targeted.
const loginLimiter = rateLimit({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
  keyBy: (req) => (req.body?.email || req.body?.phone || '').toString().toLowerCase(),
});

// OTP requests cost us an email send each, so they are capped tighter.
const otpLimiter = rateLimit({
  name: 'otp',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many OTP requests. Please wait 15 minutes before requesting another.',
  keyBy: (req) => (req.body?.email || req.body?.phone || '').toString().toLowerCase(),
});

const otpVerifyLimiter = rateLimit({
  name: 'otp-verify',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many verification attempts. Please request a new code.',
  keyBy: (req) => (req.body?.email || req.body?.phone || '').toString().toLowerCase(),
});

const registerLimiter = rateLimit({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many accounts created from this network. Please try again later.',
});

module.exports = {
  rateLimit,
  clearRateLimit,
  loginLimiter,
  otpLimiter,
  otpVerifyLimiter,
  registerLimiter,
};
