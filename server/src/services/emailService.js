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

module.exports = { sendEmail, sendOTPEmail, resolveProvider };
