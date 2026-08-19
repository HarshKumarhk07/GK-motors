const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'SparePart', required: true },
  name: String,
  price: Number,
  quantity: { type: Number, default: 1 },
  image: String,
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      lat: Number,
      lng: Number,
    },
    subtotal: { type: Number, required: true },
    shippingCharge: { type: Number, default: 50 },
    total: { type: Number, required: true },
    payment: {
      method: { type: String, enum: ['online', 'cod'], default: 'cod' },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      transactionId: String,
      razorpayOrderId: String,
      paidAt: Date,
    },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
    statusHistory: [
      {
        status: String,
        updatedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    invoiceUrl: String,
    deliveryDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
