const config = require('../config');

const sendEmail = async ({ tenantId, to, fromName, fromAddress, subject, body }) => {
  const from = fromName
    ? `${fromName} <${fromAddress || config.email.defaultFrom}>`
    : config.email.defaultFrom;

  if (config.email.mode === 'live') {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(config.email.resendApiKey);

      const result = await resend.emails.send({
        from,
        to: [to],
        subject,
        html: formatEmailHtml(body, subject),
      });

      console.log(`[EMAIL][LIVE] Sent to ${to}, id: ${result.data?.id}`);
      return { id: result.data?.id, status: 'sent' };
    } catch (err) {
      console.error(`[EMAIL][LIVE] Failed to send to ${to}: ${err.message}`);
      return { id: null, status: 'failed', error: err.message };
    }
  }

  // Mock mode
  const mockId = `MOCK_EMAIL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`\n[EMAIL][MOCK] ─────────────────────────────────`);
  console.log(`  To:      ${to}`);
  console.log(`  From:    ${from}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:    ${body.substring(0, 120)}...`);
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

module.exports = { sendEmail };
