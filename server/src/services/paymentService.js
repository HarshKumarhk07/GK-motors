const razorpay = require('../config/razorpay');
const crypto = require('crypto');

/** Razorpay signatures are lowercase hex SHA-256 HMACs — always 64 hex chars. */
const HEX_SIGNATURE = /^[a-f0-9]{64}$/i;

/**
 * Constant-time comparison of two hex signatures.
 *
 * `crypto.timingSafeEqual` throws when the two buffers differ in length, so
 * the shape is validated first and anything malformed is reported as a plain
 * failure rather than as an exception. Both sides are lower-cased before
 * decoding: Razorpay sends lowercase hex, but a proxy that upper-cases a
 * header must not be mistaken for a forgery.
 */
const safeEqualHex = (expected, received) => {
  if (typeof received !== 'string' || !HEX_SIGNATURE.test(received)) return false;
  const a = Buffer.from(String(expected).toLowerCase(), 'hex');
  const b = Buffer.from(received.toLowerCase(), 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/**
 * Read a required secret, or throw naming the variable that is missing.
 *
 * `crypto.createHmac('sha256', undefined)` throws deep inside node with an
 * opaque message, which is how a missing key ends up looking like a bug in
 * the payment code rather than a misconfigured environment.
 */
const requireSecret = (name) => {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not configured on the server.`);
  }
  return value;
};

/** Is online payment configured at all? Checked before any payment is started. */
const isPaymentConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/** Is webhook handling configured? Without a secret the webhook stays closed. */
const isWebhookConfigured = () =>
  typeof process.env.RAZORPAY_WEBHOOK_SECRET === 'string'
  && process.env.RAZORPAY_WEBHOOK_SECRET.trim() !== '';

// Create Razorpay order
const createOrder = async ({ amount, currency = 'INR', receipt }) => {
  const options = {
    amount: Math.round(amount * 100), // paise
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
  };
  const order = await razorpay.orders.create(options);
  return order;
};

/**
 * Verify a Razorpay Checkout signature.
 *
 * HMAC-SHA256 over `order_id|payment_id`, keyed with the API key secret, per
 * Razorpay's checkout integration. Returns a boolean and never throws, so a
 * missing or malformed field is treated as "not verified" — a caller can
 * never mistake a thrown error for a pass.
 */
const verifyPayment = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;

  let secret;
  try {
    secret = requireSecret('RAZORPAY_KEY_SECRET');
  } catch (err) {
    console.error('[paymentService.verifyPayment]', err.message);
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return safeEqualHex(expected, razorpay_signature);
};

/**
 * Verify a Razorpay webhook signature.
 *
 * Two things differ from checkout verification and both matter:
 *   • the key is RAZORPAY_WEBHOOK_SECRET (set when the webhook is created in
 *     the Razorpay dashboard), NOT the API key secret;
 *   • the HMAC is computed over the *raw* request body. Re-serialising the
 *     parsed JSON produces a different byte string and always fails, which is
 *     why the webhook route is mounted ahead of express.json().
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature) return false;

  let secret;
  try {
    secret = requireSecret('RAZORPAY_WEBHOOK_SECRET');
  } catch (err) {
    console.error('[paymentService.verifyWebhookSignature]', err.message);
    return false;
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  return safeEqualHex(expected, signature);
};

// Fetch payment details
const getPaymentDetails = async (paymentId) => {
  return await razorpay.payments.fetch(paymentId);
};

module.exports = {
  createOrder,
  verifyPayment,
  verifyWebhookSignature,
  isPaymentConfigured,
  isWebhookConfigured,
  getPaymentDetails,
};
