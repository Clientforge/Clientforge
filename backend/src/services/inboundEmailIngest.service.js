const { isBookingEmailIngestEnabled } = require('../config/bookingEmailIngest');
const { isVisitListEmailEnabled } = require('../config/visitListEmail');
const { processInboundBookingEmail } = require('./bookingEmailIngest.service');
const {
  processVisitListEmail,
  hasCsvAttachment,
} = require('./visitListEmailIngest.service');

function isInboundEmailIngestEnabled() {
  return isBookingEmailIngestEnabled() || isVisitListEmailEnabled();
}

/**
 * Route info@ inbound mail: CSV visit list (Bay Area Heart) vs booking NLP.
 * @param {{ messageId: string, fromAddress?: string, subject?: string, bodyText?: string, bodyHtml?: string, receivedAt?: Date, attachments?: Array }} email
 */
async function processInboundEmail(email) {
  const attachments = email.attachments || [];

  if (isVisitListEmailEnabled() && hasCsvAttachment(attachments)) {
    const visitResult = await processVisitListEmail(email);
    if (!visitResult.skipped) {
      return { ...visitResult, pipeline: 'visit_list' };
    }
  }

  if (isBookingEmailIngestEnabled()) {
    const bookingResult = await processInboundBookingEmail({
      messageId: email.messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      receivedAt: email.receivedAt,
    });
    return { ...bookingResult, pipeline: 'booking' };
  }

  return {
    ok: false,
    skipped: true,
    reason: 'no_ingest_handler',
    messageId: email.messageId,
  };
}

module.exports = {
  isInboundEmailIngestEnabled,
  processInboundEmail,
};
