const mongoose = require('mongoose');

/**
 * A message submitted through the public /contact form.
 *
 * Kept separate from Enquiry, which is specific to a marketplace car listing
 * and references a Bike document. This is a general "get in touch" record and
 * belongs to no other entity.
 */
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 20 },
    serviceType: { type: String, trim: true, maxlength: 100 },
    message: { type: String, required: [true, 'Message is required'], trim: true, maxlength: 2000 },

    // Set when a logged-in customer submits; anonymous visitors leave it null.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    status: {
      type: String,
      enum: ['new', 'contacted', 'resolved', 'spam'],
      default: 'new',
    },
    adminNote: { type: String, maxlength: 2000 },

    // Recorded for rate limiting and abuse triage, not shown in the UI.
    ip: { type: String },
  },
  { timestamps: true }
);

contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
