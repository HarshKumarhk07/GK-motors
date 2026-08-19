const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', required: true },
    message: { type: String },
    phone: { type: String },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'sold', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
