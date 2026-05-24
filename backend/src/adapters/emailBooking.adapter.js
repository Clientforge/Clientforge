/**
 * Normalize parsed booking email fields to canonical appointment event format.
 */
function normalizeEmailBooking({ parsed, messageId, rawEmail }) {
  const externalId = `email:${messageId}`;

  return {
    eventType: parsed.eventType || 'booking.created',
    contact: {
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      phone: parsed.customerPhone || null,
      email: parsed.customerEmail || null,
    },
    appointment: {
      externalId,
      provider: parsed.provider || 'email_forward',
      scheduledAt: parsed.scheduledAt,
      timezone: parsed.timezone || 'America/New_York',
      serviceName: parsed.serviceName || 'Appointment',
      durationMinutes: 30,
      rawPayload: {
        source: 'email_forward',
        messageId,
        from: rawEmail?.fromAddress,
        subject: rawEmail?.subject,
        parsed,
      },
    },
    businessName: parsed.businessName,
    confidence: parsed.confidence ?? 0,
  };
}

module.exports = { normalizeEmailBooking };
