const config = require('../config');
const { resolveEmailDestination } = require('./automation-test-mode.service');

// Extract email from "Name <email@domain.com>" or return as-is if it's already just an email
const getEmailFromDefault = (defaultFrom) => {
  const match = defaultFrom.match(/<([^>]+)>/);
  return match ? match[1] : defaultFrom;
};

const sendEmail = async ({ tenantId, to, contactId, fromName, fromAddress, subject, body }) => {
  const defaultEmail = getEmailFromDefault(config.email.defaultFrom);
  const safeName = (fromName || '').replace(/[<>[\]]/g, '').trim();
  const from = safeName
    ? `${safeName} <${fromAddress || defaultEmail}>`
    : config.email.defaultFrom;

  let destinationTo = to;
  let destinationSubject = subject;
  let destinationBody = body;

  if (tenantId) {
    const routed = await resolveEmailDestination(tenantId, { contactId, to, subject, body });
    if (routed.skipped) {
      console.warn(`[TEST-MODE] Email blocked for tenant ${tenantId} — ${routed.reason}`);
      return { id: null, status: 'skipped', reason: routed.reason };
    }
    destinationTo = routed.to;
    destinationSubject = routed.subject;
    destinationBody = routed.body;
    if (routed.testMode) {
      console.log(`[TEST-MODE] Email rerouted from ${routed.intendedTo} → ${destinationTo}`);
    }
  }

  if (config.email.mode === 'live') {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(config.email.resendApiKey);

      const { data, error } = await resend.emails.send({
        from,
        to: [destinationTo],
        subject: destinationSubject,
        html: formatEmailHtml(destinationBody, destinationSubject),
      });

      // Resend SDK does NOT throw - it returns { data, error }
      if (error) {
        console.error(`[EMAIL][LIVE] Failed to send to ${destinationTo}:`, error.message || JSON.stringify(error));
        return { id: null, status: 'failed', error: error.message };
      }

      const resendId = data?.id;
      console.log(`[EMAIL][LIVE] Sent to ${destinationTo}, id: ${resendId ?? 'undefined'}`);
      return { id: resendId, status: 'sent' };
    } catch (err) {
      console.error(`[EMAIL][LIVE] Failed to send to ${destinationTo}: ${err.message}`);
      return { id: null, status: 'failed', error: err.message };
    }
  }

  // Mock mode
  const mockId = `MOCK_EMAIL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`\n[EMAIL][MOCK] ─────────────────────────────────`);
  console.log(`  To:      ${destinationTo}`);
  console.log(`  From:    ${from}`);
  console.log(`  Subject: ${destinationSubject}`);
  console.log(`  Body:    ${destinationBody.substring(0, 120)}...`);
  console.log(`[EMAIL][MOCK] ─────────────────────────────────\n`);

  return { id: mockId, status: 'sent' };
};

const formatEmailHtml = (body, subject) => {
  const escapedBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr><td style="padding:32px 40px;">
      <div style="font-size:15px;line-height:1.6;color:#1f2937;">${escapedBody}</div>
    </td></tr>
    <tr><td style="padding:16px 40px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      You received this email because you are a customer. If you no longer wish to receive emails, reply STOP.
    </td></tr>
  </table>
</body>
</html>`;
};

/**
 * Send welcome email to a new tenant's admin user.
 * Called automatically on registration and manually from admin dashboard.
 */
const sendWelcomeEmail = async ({ tenantName, toEmail, recipientName }) => {
  const subject = `Welcome to ClientForge.ai — ${tenantName}`;
  const name = recipientName || 'there';
  const body = `Hi ${name},

Welcome to ClientForge.ai! Your account for ${tenantName} is ready.

Here's how to get started:

1. **Add your Twilio number** — Go to Settings and add your SMS phone number so leads can receive texts.
2. **Set up your booking link** — Add your Calendly or scheduling link in Settings.
3. **Connect your lead sources** — Use your API key to send leads from your website, forms, or ads to our webhook.

Need help? Reply to this email or visit your dashboard Settings for integration details.

Let's turn more leads into customers!

— The ClientForge.ai Team`;

  return sendEmail({
    tenantId: null,
    to: toEmail,
    fromName: 'ClientForge.ai',
    fromAddress: null,
    subject,
    body,
  });
};

module.exports = { sendEmail, sendWelcomeEmail };
