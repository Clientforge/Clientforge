/**
 * Square Bookings webhook → canonical booking event.
 *
 * Webhook payload includes booking + customer_id; customer phone/email and service names
 * are enriched via Square API before calling this normalizer.
 */

function resolveEventType(squareType, booking) {
  const status = String(booking?.status || '').toUpperCase();
  if (squareType === 'booking.created') {
    if (status === 'CANCELLED') return 'booking.cancelled';
    return 'booking.created';
  }
  if (squareType === 'booking.updated') {
    if (status === 'CANCELLED') return 'booking.cancelled';
    return 'booking.rescheduled';
  }
  return 'booking.created';
}

function parseDurationMinutes(booking) {
  const segments = booking?.appointment_segments;
  if (!Array.isArray(segments) || segments.length === 0) return 30;
  const total = segments.reduce((sum, seg) => sum + (seg.duration_minutes || 0), 0);
  return total > 0 ? total : 30;
}

function resolveServiceName(booking, serviceNames = []) {
  const names = serviceNames.filter(Boolean);
  if (names.length === 1) return names[0];
  if (names.length > 1) return names.join(', ');
  return 'Appointment';
}

/**
 * @param {object} params
 * @param {object} params.raw Full Square webhook body
 * @param {object} params.booking booking object from data.object.booking
 * @param {object} [params.customer] Square Customer from Customers API
 * @param {string[]} [params.serviceNames] Resolved catalog service names
 */
function normalizeSquareBooking({ raw, booking, customer, serviceNames = [] }) {
  if (!booking?.id) return null;

  const squareType = raw?.type || 'booking.created';
  const eventType = resolveEventType(squareType, booking);

  const firstName = customer?.given_name || customer?.givenName || null;
  const lastName = customer?.family_name || customer?.familyName || null;
  const phone = customer?.phone_number || customer?.phoneNumber || null;
  const email = customer?.email_address || customer?.emailAddress || null;

  if (!phone && !email && !firstName) {
    return null;
  }

  return {
    eventType,
    contact: {
      firstName,
      lastName,
      phone,
      email,
    },
    appointment: {
      externalId: `square:${booking.id}`,
      provider: 'square',
      scheduledAt: booking.start_at,
      timezone: 'America/New_York',
      serviceName: resolveServiceName(booking, serviceNames),
      durationMinutes: parseDurationMinutes(booking),
      rawPayload: raw,
    },
  };
}

module.exports = {
  normalizeSquareBooking,
  resolveEventType,
  resolveServiceName,
  parseDurationMinutes,
};
