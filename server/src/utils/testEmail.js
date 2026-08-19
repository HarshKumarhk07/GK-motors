require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sendEmail, resolveProvider } = require('../services/emailService');

/**
 * Verify email delivery without going through the app.
 *
 *   node server/src/utils/testEmail.js you@example.com
 *
 * Reports which provider was selected, then sends one test message.
 * Does not touch the database.
 */
const run = async () => {
  const to = process.argv[2];
  const provider = resolveProvider();

  console.log(`\nProvider selected: ${provider}`);
  if (provider === 'brevo-api') {
    console.log(`  BREVO_API_KEY  set (${String(process.env.BREVO_API_KEY).slice(0, 8)}…)`);
  } else if (provider === 'smtp') {
    console.log(`  host  ${process.env.SMTP_HOST || process.env.MAIL_HOST}:${process.env.SMTP_PORT || 587}`);
    console.log(`  user  ${process.env.SMTP_USER || process.env.EMAIL_USER}`);
  }
  console.log(`  from  ${process.env.FROM_NAME || 'GK Motors'} <${process.env.FROM_EMAIL || '(unset)'}>\n`);

  if (provider === 'none') {
    console.error('❌ No email provider configured.');
    console.error('   Set BREVO_API_KEY (preferred) or SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env');
    process.exit(1);
  }
  if (!to) {
    console.error('❌ Pass a recipient:  node server/src/utils/testEmail.js you@example.com');
    process.exit(1);
  }

  try {
    await sendEmail({
      to,
      subject: 'GK Motors email test',
      html: '<div style="font-family:sans-serif;padding:20px"><h2 style="color:#1E3A8A">It works</h2>'
          + '<p>If you can read this, GK Motors can send OTP emails.</p></div>',
    });
    console.log(`\n✅ Sent. Check ${to} (including spam).\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ${err.message}\n`);
    process.exit(1);
  }
};

run();
