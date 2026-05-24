const crypto = require('crypto');
const { processInboundBookingEmail } = require('../services/bookingEmailIngest.service');
const { stripHtml } = require('../services/bookingEmailParse.service');

function verifyWebhookSecret(req) {
  const secret = process.env.BOOKING_EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header = req.headers['x-booking-email-secret'] || req.query.secret;
  return header === secret;
}

function messageIdFromPayload(body, headers = {}) {
  const explicit = body.messageId || body.message_id || headers['message-id'];
  if (explicit) return String(explicit).trim();
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ from: body.from, subject: body.subject, text: body.text || body.bodyText }))
    .digest('hex')
    .slice(0, 32);
  return `generated:${hash}`;
}

/**
 * POST /api/v1/webhook/booking-email
 *
 * Accepts:
 * - Simple JSON: { messageId?, from, subject, text|bodyText, html|bodyHtml, date? }
 * - SendGrid-ish: { from, subject, text, html, headers }
 */
async function handleBookingEmailWebhook(req, res, next) {
  try {
    if (!verifyWebhookSecret(req)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const body = req.body || {};
    const fromAddress =
      typeof body.from === 'string'
        ? body.from
        : body.from?.email || body.envelope?.from || body.sender || '';

    const subject = body.subject || '';
    const bodyText = body.text || body.bodyText || body.plain || '';
    const bodyHtml = body.html || body.bodyHtml || '';
    const receivedAt = body.date || body.receivedAt ? new Date(body.date || body.receivedAt) : new Date();

    const messageId = messageIdFromPayload(body, body.headers || req.headers);

    const result = await processInboundBookingEmail({
      messageId,
      fromAddress,
      subject,
      bodyText: bodyText || stripHtml(bodyHtml),
      bodyHtml,
      receivedAt,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { handleBookingEmailWebhook };
