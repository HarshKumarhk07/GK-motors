const nodemailer = require('nodemailer');

/**
 * Email delivery for GK Motors.
 *
 * Two providers, chosen automatically from what is configured:
 *
 *   1. Brevo transactional API  — set BREVO_API_KEY. Plain HTTPS, so it works
 *      on hosts that block outbound SMTP ports (Render, Railway, most
 *      serverless). This is the preferred option.
 *   2. SMTP via nodemailer      — set SMTP_HOST/SMTP_USER/SMTP_PASS. Works with
 *      Brevo's relay (smtp-relay.brevo.com:587) or any other SMTP provider.
 *
 * If neither is configured, sending throws with a message naming what to set,
 * rather than failing somewhere deep inside nodemailer.
 *
 * Note on env names: earlier versions of this project documented
 * MAIL_HOST / EMAIL_USER / EMAIL_PASS while the code read SMTP_* — so email
 * silently never sent. Both spellings are accepted below.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 15000);

const firstSet = (...values) => values.find((v) => typeof v === 'string' && v.trim() !== '');

const config = () => ({
  brevoApiKey: firstSet(process.env.BREVO_API_KEY),
  smtpHost: firstSet(process.env.SMTP_HOST, process.env.MAIL_HOST, process.env.BREVO_SMTP_HOST),
  smtpPort: Number(firstSet(process.env.SMTP_PORT, process.env.MAIL_PORT) || 587),
  smtpUser: firstSet(process.env.SMTP_USER, process.env.EMAIL_USER, process.env.BREVO_SMTP_LOGIN),
  smtpPass: firstSet(process.env.SMTP_PASS, process.env.EMAIL_PASS, process.env.BREVO_SMTP_KEY),
  fromEmail: firstSet(process.env.FROM_EMAIL, process.env.EMAIL_USER),
  fromName: firstSet(process.env.FROM_NAME) || 'GK Motors',
});

/** Which provider will actually be used: 'brevo-api' | 'smtp' | 'none'. */
const resolveProvider = () => {
  const c = config();
  if (c.brevoApiKey) return 'brevo-api';
  if (c.smtpHost && c.smtpUser && c.smtpPass) return 'smtp';
  return 'none';
};

// Log the choice once at startup so a misconfiguration is obvious in the logs
// rather than only surfacing when a customer requests an OTP.
let announced = false;
const announce = () => {
  if (announced) return;
  announced = true;
  const provider = resolveProvider();
  const c = config();
  if (provider === 'brevo-api') {
    console.log(`📧 Email: Brevo API, sending as ${c.fromName} <${c.fromEmail}>`);
  } else if (provider === 'smtp') {
    console.log(`📧 Email: SMTP ${c.smtpHost}:${c.smtpPort}, sending as ${c.fromName} <${c.fromEmail}>`);
  } else {
    console.warn('⚠️  Email is not configured — OTP login by email will fail. Set BREVO_API_KEY (preferred) or SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env');
  }
};

const stripHtml = (html) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

// ── Brevo transactional API ───────────────────────────────────────────────
const sendViaBrevo = async ({ to, subject, html, text }) => {
  const c = config();
  if (!c.fromEmail) {
    throw new Error('FROM_EMAIL is not set. Brevo requires a sender address you have verified in Senders & IP.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'api-key': c.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: c.fromName, email: c.fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || stripHtml(html),
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Brevo did not respond within ${SEND_TIMEOUT_MS}ms`);
    }
    throw new Error(`Could not reach Brevo: ${err.message}`);
  }
  clearTimeout(timer);

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Brevo answers { code, message }. Translate the two that actually bite.
    const code = body.code || '';
    const detail = body.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`Brevo rejected the API key (${detail}). Check BREVO_API_KEY in server/.env.`);
    }
    if (code === 'invalid_parameter' && /sender/i.test(detail)) {
      throw new Error(`Brevo rejected the sender ${c.fromEmail} (${detail}). Verify it under Senders, Domains & Dedicated IPs.`);
    }
    throw new Error(`Brevo error: ${detail}`);
  }

  return { messageId: body.messageId, provider: 'brevo-api' };
};

// ── SMTP ──────────────────────────────────────────────────────────────────
let transporter = null;
const getTransporter = () => {
  const c = config();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpPort === 465,     // 587 uses STARTTLS, not implicit TLS
      auth: { user: c.smtpUser, pass: c.smtpPass },
      connectionTimeout: SEND_TIMEOUT_MS,
    });
  }
  return transporter;
};

const sendViaSmtp = async ({ to, subject, html, text }) => {
  const c = config();
  const info = await getTransporter().sendMail({
    from: `"${c.fromName}" <${c.fromEmail || c.smtpUser}>`,
    to,
    subject,
    html,
    text: text || stripHtml(html),
  });
  return { messageId: info.messageId, provider: 'smtp' };
};

// ── public API ────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
  announce();
  const provider = resolveProvider();

  if (provider === 'none') {
    throw new Error(
      'Email is not configured. Set BREVO_API_KEY (preferred) or SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env'
    );
  }
  if (!to) throw new Error('No recipient address supplied');

  try {
    const result = provider === 'brevo-api'
      ? await sendViaBrevo({ to, subject, html, text })
      : await sendViaSmtp({ to, subject, html, text });
    console.log(`📧 Email sent via ${result.provider} to ${to} (${result.messageId || 'no id'})`);
    return result;
  } catch (error) {
    console.error(`Email send failed via ${provider} ->`, error.message);
    throw error;
  }
};

const otpTemplate = (otp) => `
  <div style="background:#F8FAFC;padding:32px 16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1E3A8A 0%,#0F172A 100%);padding:24px 28px;">
        <span style="color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:0.02em;">GK Motors</span>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 8px;color:#0F172A;font-size:19px;font-weight:800;">Your verification code</h2>
        <p style="margin:0 0 22px;color:#475569;font-size:14px;line-height:1.6;">
          Use the code below to sign in. It expires in 10 minutes.
        </p>
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;text-align:center;margin-bottom:22px;">
          <span style="font-size:34px;font-weight:800;color:#1E3A8A;letter-spacing:10px;">${otp}</span>
        </div>
        <p style="margin:0;color:#64748B;font-size:12.5px;line-height:1.6;">
          If you didn't request this, you can safely ignore this email.
          Never share this code with anyone — GK Motors will never ask you for it.
        </p>
      </div>
      <div style="border-top:1px solid #E2E8F0;padding:16px 28px;">
        <span style="color:#94A3B8;font-size:11.5px;">© ${new Date().getFullYear()} GK Motors · Avani Enterprises</span>
      </div>
    </div>
  </div>
`;

const sendOTPEmail = async (email, otp) => {
  await sendEmail({
    to: email,
    subject: `${otp} is your GK Motors verification code`,
    html: otpTemplate(otp),
    text: `Your GK Motors verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`,
  });
};

/* ─────────────────────────────────────────────────────────────────────────
   Shared chrome for the transactional templates.

   Everything is inline-styled on purpose. Gmail and Outlook strip <style>
   blocks from <head>, so a stylesheet-based template arrives as unstyled
   text — inline attributes are the only thing that survives everywhere.
   ───────────────────────────────────────────────────────────────────────── */

const SERVICE_CENTER_LINE =
  'GK Motors, Sheela By Pass, near New Railway Crossing, Jasbir Colony, Sector-5, Rohtak, Haryana 124001';

const shell = (title, subtitle, body) => `
  <div style="background:#F8FAFC;padding:32px 16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1E3A8A 0%,#0F172A 100%);padding:28px;">
        <div style="color:#FFFFFF;font-size:22px;font-weight:800;margin-bottom:6px;">${title}</div>
        <div style="color:#BFDBFE;font-size:13.5px;">${subtitle}</div>
      </div>
      <div style="padding:28px;">
        ${body}
      </div>
      <div style="border-top:1px solid #E2E8F0;padding:18px 28px;">
        <div style="color:#0F172A;font-size:12.5px;font-weight:700;margin-bottom:4px;">GK Motors</div>
        <div style="color:#94A3B8;font-size:11.5px;line-height:1.6;">${SERVICE_CENTER_LINE}</div>
        <div style="color:#94A3B8;font-size:11.5px;margin-top:6px;">© ${new Date().getFullYear()} GK Motors · Avani Enterprises</div>
      </div>
    </div>
  </div>
`;

const card = (heading, rows) => `
  <div style="border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:16px;">
    <div style="color:#1E3A8A;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">${heading}</div>
    ${rows}
  </div>
`;

const row = (label, value) => `
  <div style="padding:7px 0;border-bottom:1px solid #F1F5F9;">
    <span style="color:#64748B;font-size:13px;">${label}</span>
    <span style="color:#0F172A;font-size:13.5px;font-weight:700;float:right;text-align:right;">${value}</span>
    <div style="clear:both;"></div>
  </div>
`;

const highlight = (label, value) => `
  <div style="background:#EFF6FF;border-left:4px solid #1E3A8A;border-radius:6px;padding:13px 15px;margin-bottom:10px;">
    <div style="color:#1E3A8A;font-size:12px;font-weight:800;margin-bottom:4px;">${label}</div>
    <div style="color:#0F172A;font-size:13.5px;line-height:1.6;">${value}</div>
  </div>
`;

// Anything interpolated into a template can come from user input (a car model,
// an address line). Escaping keeps a stray < or & from breaking the markup.
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const addressLine = (a) => {
  if (!a) return '—';
  const parts = [a.street, a.city, a.state].filter(Boolean).map(esc);
  const line = parts.join(', ');
  return a.pincode ? `${line} - ${esc(a.pincode)}` : (line || '—');
};

/**
 * Welcome mail, sent once when an account is created.
 * Never throws into the caller's critical path — see authController.
 */
const sendWelcomeEmail = async (user) => {
  const clientUrl = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
  const perks = [
    ['🔧', 'Book professional car servicing online'],
    ['🚗', 'Doorstep pickup &amp; drop, 9:00 AM to 6:00 PM'],
    ['👨‍🔧', 'Factory-trained, background-verified technicians'],
    ['✅', 'Genuine parts with a 12-month warranty'],
  ].map(([icon, text]) => `
    <div style="background:#F8FAFC;border-radius:8px;padding:11px 14px;margin-bottom:8px;">
      <span style="font-size:15px;margin-right:8px;">${icon}</span>
      <span style="color:#334155;font-size:13.5px;">${text}</span>
    </div>
  `).join('');

  const cta = clientUrl
    ? `<a href="${clientUrl}/services" style="display:inline-block;background:#1E3A8A;color:#FFFFFF;padding:13px 26px;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;margin-top:18px;">Book a Service</a>`
    : '';

  await sendEmail({
    to: user.email,
    subject: 'Welcome to GK Motors',
    html: shell('Welcome to GK Motors', 'Your trusted car service partner', `
      <p style="margin:0 0 14px;color:#0F172A;font-size:15px;">Hello <strong>${esc(user.name)}</strong>,</p>
      <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.65;">
        Your account is ready. Here is what you can do with it:
      </p>
      ${perks}
      ${cta}
    `),
    text: `Hello ${user.name}, your GK Motors account is ready. `
        + `Book a service at ${clientUrl || 'our website'}/services. ${SERVICE_CENTER_LINE}`,
  });
};

/**
 * The blocks both booking emails are built from.
 *
 * Extracted so the "received" and "confirmed" templates can never drift in
 * what they tell the customer about their car, services, slot and logistics.
 * The only thing that differs between the two is the payment story.
 *
 * Every field is defensive: bookings made before a field existed, or through
 * the older single-service flow, still have to produce a sensible email
 * rather than throwing inside the send.
 */
const bookingBlocks = (booking, serviceCenter = {}) => {
  const centerLine = serviceCenter.fullAddress || SERVICE_CENTER_LINE;
  const car = booking.selectedCar || {};
  const services = Array.isArray(booking.services) ? booking.services : [];
  const pd = booking.pickupDrop || {};

  const carName = [car.brand, car.model].filter(Boolean).join(' ')
    || [booking.bikeBrand, booking.bikeModel].filter(Boolean).join(' ')
    || 'Your car';

  const carCard = card('Car', [
    row('Vehicle', esc(carName)),
    car.year || booking.bikeYear ? row('Year', esc(car.year || booking.bikeYear)) : '',
    car.fuelType ? row('Fuel', esc(car.fuelType)) : '',
  ].filter(Boolean).join(''));

  const serviceRows = services.length
    ? services.map((s) => row(esc(s.name || 'Service'), inr(s.price))).join('')
    : row(esc(booking.serviceLabel || 'Service'), inr(booking.totalAmount));

  const when = booking.scheduledDate
    ? new Date(booking.scheduledDate).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  const logistics = pd.enabled
    ? card('Pickup &amp; drop', `
        ${highlight('We collect from', addressLine(pd.pickupAddress))}
        ${highlight(
          pd.dropType === 'service_center' ? 'Collect your car from' : 'We return it to',
          pd.dropType === 'service_center' ? esc(centerLine) : addressLine(pd.dropAddress)
        )}
        <div style="color:#64748B;font-size:12px;margin-top:8px;">
          🕐 Our driver will call before arriving. Pickup and drop run 9:00 AM to 6:00 PM.
        </div>
      `)
    : card('Drop off', `
        ${highlight('Please bring your car to', esc(centerLine))}
        <div style="color:#64748B;font-size:12px;margin-top:8px;">
          Arriving at your booked slot keeps the wait short.
        </div>
      `);

  return {
    centerLine,
    carName,
    carCard,
    serviceRows,
    when,
    logistics,
    pickupEnabled: Boolean(pd.enabled),
    reference: String(booking._id).slice(-8).toUpperCase(),
  };
};

/** The dark money strip that closes both booking emails. */
const totalStrip = (label, amount) => `
  <div style="background:#0F172A;border-radius:10px;padding:16px 20px;margin-top:4px;">
    <span style="color:#CBD5E1;font-size:14px;">${label}</span>
    <span style="color:#FFFFFF;font-size:21px;font-weight:800;float:right;">${inr(amount)}</span>
    <div style="clear:both;"></div>
  </div>
`;

/** Link back into the customer's own booking list, when CLIENT_URL is set. */
const bookingsCta = (label) => {
  const clientUrl = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
  if (!clientUrl) return '';
  return `<div style="text-align:center;margin-top:22px;">
      <a href="${clientUrl}/my-bookings?tab=services" style="display:inline-block;background:#1E3A8A;color:#FFFFFF;padding:13px 26px;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">${label}</a>
    </div>`;
};

/**
 * Booking received — payment still pending.
 *
 * Sent when the booking record is created, which happens BEFORE the customer
 * ever reaches the Razorpay sheet. It must therefore never claim the booking
 * is confirmed or that anything has been paid. Until verifyServicePayment
 * flips payment.status to 'paid' the slot is only held provisionally — see
 * SLOT_HOLD_MINUTES in controllers/serviceController.js.
 */
const sendBookingReceivedEmail = async (user, booking, serviceCenter = {}) => {
  const b = bookingBlocks(booking, serviceCenter);

  const pendingBanner = `
    <div style="background:#FFFBEB;border:1px solid #FCD34D;border-left:4px solid #B45309;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <div style="color:#92400E;font-size:13px;font-weight:800;margin-bottom:4px;">PAYMENT PENDING</div>
      <div style="color:#92400E;font-size:13px;line-height:1.6;">
        Your slot is held for a short time only. Complete the payment to secure this booking —
        until then it is not confirmed.
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `Booking received — payment pending (${b.reference})`,
    html: shell('Booking received', `Reference ${b.reference} · Awaiting payment`, `
      <p style="margin:0 0 14px;color:#0F172A;font-size:15px;">Hello <strong>${esc(user.name)}</strong>,</p>
      <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.65;">
        We have your service request. <strong>It is not confirmed yet</strong> — we will confirm it
        as soon as your payment goes through.
      </p>
      ${pendingBanner}
      ${b.carCard}
      ${card('Services requested', b.serviceRows)}
      ${card('Requested slot', row('Date', esc(b.when)) + row('Time', esc(booking.scheduledTime || '—')))}
      ${b.logistics}
      ${totalStrip('Amount due', booking.totalAmount)}
      ${bookingsCta('Complete Payment')}
    `),
    text: `Hello ${user.name}, we have received your GK Motors service request for ${b.when} at ${booking.scheduledTime || ''} `
        + `(${b.carName}, reference ${b.reference}). This booking is NOT confirmed yet — payment of ${inr(booking.totalAmount)} is still pending. `
        + 'Your slot is held for a short time only. Complete the payment from My Bookings to secure it.',
  });
};

/**
 * Booking confirmed — payment received and verified.
 *
 * Only ever sent from verifyServicePayment / the Razorpay webhook, after the
 * signature has been verified server-side AND the booking has actually
 * transitioned from unpaid to paid. Never call this from booking creation.
 */
const sendBookingConfirmationEmail = async (user, booking, serviceCenter = {}) => {
  const b = bookingBlocks(booking, serviceCenter);
  const pay = booking.payment || {};

  const paidBanner = `
    <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-left:4px solid #16A34A;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <div style="color:#166534;font-size:13px;font-weight:800;margin-bottom:4px;">PAYMENT RECEIVED</div>
      <div style="color:#166534;font-size:13px;line-height:1.6;">
        We have received ${inr(pay.advancePaid || booking.totalAmount)}. Your slot is secured.
      </div>
    </div>
  `;

  const paymentCard = card('Payment', [
    row('Status', 'Paid'),
    row('Amount', inr(pay.advancePaid || booking.totalAmount)),
    pay.razorpayPaymentId ? row('Payment ID', esc(pay.razorpayPaymentId)) : '',
    pay.paidAt
      ? row('Paid on', esc(new Date(pay.paidAt).toLocaleDateString('en-IN', {
          year: 'numeric', month: 'long', day: 'numeric',
        })))
      : '',
  ].filter(Boolean).join(''));

  await sendEmail({
    to: user.email,
    subject: `Booking confirmed — ${b.carName} on ${b.when}`,
    html: shell('Booking confirmed', `Reference ${b.reference} · Paid`, `
      <p style="margin:0 0 14px;color:#0F172A;font-size:15px;">Hello <strong>${esc(user.name)}</strong>,</p>
      <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.65;">
        Your payment is confirmed and your service booking is secured. Here are the details:
      </p>
      ${paidBanner}
      ${b.carCard}
      ${card('Services booked', b.serviceRows)}
      ${card('Schedule', row('Date', esc(b.when)) + row('Time', esc(booking.scheduledTime || '—')))}
      ${b.logistics}
      ${paymentCard}
      ${totalStrip('Total paid', pay.advancePaid || booking.totalAmount)}
    `),
    text: `Hello ${user.name}, your GK Motors booking is confirmed and paid for ${b.when} at ${booking.scheduledTime || ''}. `
        + `${b.carName}. Reference ${b.reference}. Total paid ${inr(pay.advancePaid || booking.totalAmount)}. `
        + (b.pickupEnabled ? 'Doorstep pickup is arranged.' : `Please bring your car to: ${b.centerLine}`),
  });
};

/**
 * Booking status update email, sent whenever the admin/mechanic changes booking status.
 */
const sendBookingStatusUpdateEmail = async (user, booking, previousStatus, newStatus, note = '') => {
  if (!user?.email) return;

  const STATUS_DETAILS = {
    requested: {
      label: 'Requested',
      color: '#FB8C00',
      title: 'Booking Received',
      message: 'Your service request has been received and is currently under review by our service team.',
    },
    accepted: {
      label: 'Accepted & Confirmed',
      color: '#2563EB',
      title: 'Booking Accepted',
      message: 'Your car service booking has been confirmed! Our team is preparing for your scheduled slot.',
    },
    in_progress: {
      label: 'In Progress',
      color: '#0284C7',
      title: 'Service in Progress',
      message: 'Your car is currently in our service bay and being worked on by our certified technicians.',
    },
    completed: {
      label: 'Completed',
      color: '#16A34A',
      title: 'Service Completed',
      message: 'Great news! Your car servicing has been completed and your vehicle is ready.',
    },
    cancelled: {
      label: 'Cancelled',
      color: '#DC2626',
      title: 'Booking Cancelled',
      message: 'Your service booking has been cancelled. Please contact us if you have any questions.',
    },
  };

  let info = STATUS_DETAILS[newStatus] || {
    label: newStatus?.replace(/_/g, ' ')?.toUpperCase() || 'Updated',
    color: '#1E3A8A',
    title: 'Booking Status Updated',
    message: `Your booking status has been updated to ${newStatus}.`,
  };

  /* ── Never claim a booking is confirmed while it is unpaid ──────────────
     'accepted' is the one status whose copy asserts confirmation ("your
     booking has been confirmed!"), and updateBookingStatus auto-promotes a
     'requested' booking to 'accepted' the moment a mechanic is assigned. On
     an unpaid booking that produced a second false confirmation, entirely
     independent of the checkout flow. The status update itself is legitimate
     and still goes out — only the wording changes, so the customer is told
     what actually happened and what is still outstanding. */
  const isPaid = booking?.payment?.status === 'paid';
  if (!isPaid && newStatus === 'accepted') {
    info = {
      ...info,
      label: 'Accepted · Payment Pending',
      color: '#B45309',
      title: 'Booking Accepted — Payment Pending',
      message: 'Our team has accepted your service request. Your payment has not reached us yet, '
        + 'so the booking is not confirmed — please complete the payment to secure your slot.',
    };
  }

  /* A short amber strip on any unpaid update, so no status mail can read as a
     receipt. Cancelled bookings are excluded: chasing payment for a booking we
     have just cancelled would be nonsense. */
  const unpaidBanner = !isPaid && newStatus !== 'cancelled'
    ? `<div style="background:#FFFBEB;border:1px solid #FCD34D;border-left:4px solid #B45309;border-radius:8px;padding:12px 15px;margin-bottom:16px;">
        <div style="color:#92400E;font-size:12.5px;font-weight:800;margin-bottom:3px;">PAYMENT PENDING</div>
        <div style="color:#92400E;font-size:12.5px;line-height:1.6;">
          This booking is not paid for yet. Complete the payment from My Bookings to secure your slot.
        </div>
      </div>`
    : '';

  const clientUrl = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
  const car = booking.selectedCar || {};
  const services = Array.isArray(booking.services) ? booking.services : [];
  const carName = [car.brand, car.model].filter(Boolean).join(' ')
    || [booking.bikeBrand, booking.bikeModel].filter(Boolean).join(' ')
    || 'Your car';

  const when = booking.scheduledDate
    ? new Date(booking.scheduledDate).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  const mechanicInfo = booking.mechanic
    ? card('Assigned Technician', `
        ${row('Technician', esc(booking.mechanic.name || 'Assigned'))}
        ${booking.mechanic.phone ? row('Contact', esc(booking.mechanic.phone)) : ''}
      `)
    : '';

  const noteBlock = note
    ? highlight('Update Note', esc(note))
    : '';

  const serviceSummary = services.length
    ? services.map((s) => s.name).join(', ')
    : (booking.serviceLabel || 'Vehicle Service');

  const cta = clientUrl
    ? `<div style="text-align:center;margin-top:24px;">
        <a href="${clientUrl}/my-bookings?tab=services" style="display:inline-block;background:#1E3A8A;color:#FFFFFF;padding:13px 26px;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">View Booking in Dashboard</a>
       </div>`
    : '';

  await sendEmail({
    to: user.email,
    subject: `Status Update: ${info.title} — ${carName}`,
    html: shell(info.title, `Booking Ref: ${String(booking._id).slice(-8).toUpperCase()}`, `
      <p style="margin:0 0 14px;color:#0F172A;font-size:15px;">Hello <strong>${esc(user.name)}</strong>,</p>
      <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.65;">
        ${info.message}
      </p>

      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:16px;text-align:center;">
        <span style="display:inline-block;background:${info.color};color:#FFFFFF;font-weight:800;font-size:13px;padding:6px 16px;border-radius:20px;letter-spacing:0.04em;text-transform:uppercase;">
          Status: ${info.label}
        </span>
      </div>

      ${unpaidBanner}

      ${noteBlock}

      ${card('Booking Details', `
        ${row('Vehicle', esc(carName))}
        ${row('Service', esc(serviceSummary))}
        ${row('Scheduled Date', esc(when))}
        ${row('Scheduled Time', esc(booking.scheduledTime || '—'))}
        ${booking.totalAmount ? row('Total Amount', inr(booking.totalAmount)) : ''}
        ${row('Payment', isPaid ? 'Paid' : 'Pending')}
      `)}

      ${mechanicInfo}

      ${cta}
    `),
    text: `Hello ${user.name}, your GK Motors booking (${String(booking._id).slice(-8).toUpperCase()}) for ${carName} is now: ${info.label}. ${info.message}. View at ${clientUrl}/my-bookings`,
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendBookingReceivedEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusUpdateEmail,
  resolveProvider,
};
