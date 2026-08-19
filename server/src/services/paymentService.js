const razorpay = require('../config/razorpay');
const crypto = require('crypto');

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

// Verify payment signature
const verifyPayment = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === razorpay_signature;
};

// Fetch payment details
const getPaymentDetails = async (paymentId) => {
  return await razorpay.payments.fetch(paymentId);
};

module.exports = { createOrder, verifyPayment, getPaymentDetails };
