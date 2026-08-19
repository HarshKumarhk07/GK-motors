const asyncHandler = require('express-async-handler');
const ContactMessage = require('../models/ContactMessage');
const { sendEmail, resolveProvider } = require('../services/emailService');

// A visitor may send this many messages per window before being throttled.
const RATE_LIMIT = Number(process.env.CONTACT_RATE_LIMIT || 3);
const RATE_WINDOW_MS = 15 * 60 * 1000;

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

// @desc  Submit a contact form message
// @route POST /api/contact
// @access Public
const createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, serviceType, message } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Please tell us your name');
  }
  if (!message || !String(message).trim()) {
    res.status(400);
    throw new Error('Please write a message');
  }
  if (!email && !phone) {
    res.status(400);
    throw new Error('Please leave an email address or a phone number so we can reply');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    res.status(400);
    throw new Error('That email address does not look right');
  }
  if (phone && !/^[+]?[\d\s-]{7,15}$/.test(String(phone).trim())) {
    res.status(400);
    throw new Error('That phone number does not look right');
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;

  // Cheap abuse guard: cap submissions per IP per window. Skipped when the IP
  // is unknown (behind a proxy that strips it) rather than blocking everyone.
  if (ip) {
    const recent = await ContactMessage.countDocuments({
      ip,
      createdAt: { $gte: new Date(Date.now() - RATE_WINDOW_MS) },
    });
    if (recent >= RATE_LIMIT) {
      res.status(429);
      throw new Error('You have sent several messages already. Please wait a little before sending another.');
    }
  }

  const doc = await ContactMessage.create({
    name: String(name).trim(),
    email: email ? String(email).trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
    serviceType: serviceType ? String(serviceType).trim() : undefined,
    message: String(message).trim(),
    user: req.user?._id || null,
    ip,
  });

  // Notify the team. Best-effort: a missing email provider must not lose the
  // message, which is already safely stored above.
  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL || process.env.FROM_EMAIL;
  if (notifyTo && resolveProvider() !== 'none') {
    try {
      await sendEmail({
        to: notifyTo,
        subject: `New enquiry from ${doc.name}${doc.serviceType ? ` — ${doc.serviceType}` : ''}`,
        html: `
          <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;">
            <h2 style="color:#1E3A8A;margin:0 0 16px;">New contact enquiry</h2>
            <table style="border-collapse:collapse;font-size:14px;color:#0F172A;">
              <tr><td style="padding:4px 12px 4px 0;color:#64748B;">Name</td><td>${escapeHtml(doc.name)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#64748B;">Email</td><td>${escapeHtml(doc.email || '—')}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#64748B;">Phone</td><td>${escapeHtml(doc.phone || '—')}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#64748B;">Service</td><td>${escapeHtml(doc.serviceType || '—')}</td></tr>
            </table>
            <p style="margin:18px 0 6px;color:#64748B;font-size:13px;">Message</p>
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;white-space:pre-wrap;font-size:14px;color:#0F172A;">${escapeHtml(doc.message)}</div>
          </div>`,
      });
    } catch (err) {
      console.error('Contact notification email failed ->', err.message);
    }
  }

  res.status(201).json({
    success: true,
    message: "Thanks — we've got your message and will be in touch shortly.",
    id: doc._id,
  });
});

// @desc  List contact messages
// @route GET /api/contact
// @access Admin
const getContactMessages = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status } : {};
  const total = await ContactMessage.countDocuments(query);
  const messages = await ContactMessage.find(query)
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const newCount = await ContactMessage.countDocuments({ status: 'new' });
  res.json({ success: true, total, newCount, messages });
});

// @desc  Update a message's status or note
// @route PUT /api/contact/:id
// @access Admin
const updateContactMessage = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const update = {};
  if (status) update.status = status;
  if (adminNote !== undefined) update.adminNote = adminNote;

  const doc = await ContactMessage.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!doc) { res.status(404); throw new Error('Message not found'); }
  res.json({ success: true, message: doc });
});

module.exports = { createContactMessage, getContactMessages, updateContactMessage };
