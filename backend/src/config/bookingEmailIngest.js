/**
 * Booking email ingest (IMAP poll + forwarded-email webhook) is disabled by default.
 * Set BOOKING_EMAIL_INGEST_ENABLED=true to re-enable.
 */
function isBookingEmailIngestEnabled() {
  return process.env.BOOKING_EMAIL_INGEST_ENABLED === 'true';
}

module.exports = {
  isBookingEmailIngestEnabled,
};
