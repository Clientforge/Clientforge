/**
 * Google Calendar event → canonical booking event (same shape as Calendly / email adapters).
 */

function parseDurationMinutes(event) {
  const startRaw = event.start?.dateTime || event.start?.date;
  const endRaw = event.end?.dateTime || event.end?.date;
  if (!startRaw || !endRaw) return 30;
  const startMs = new Date(startRaw).getTime();
  const endMs = new Date(endRaw).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 30;
  return Math.max(1, Math.round((endMs - startMs) / 60000));
}

function splitFullName(full) {
  const cleaned = String(full || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { firstName: null, lastName: null };
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Extract client name from event title when attendee displayName is missing.
 * Supports GlossGenius, Portrait Care / booking-system title patterns.
 */
function parseNameFromSummary(summary) {
  if (!summary || !String(summary).trim()) {
    return { firstName: null, lastName: null };
  }

  const s = String(summary).trim();

  const forMatch = s.match(/\sfor\s+(.+)$/i);
  if (forMatch) {
    return splitFullName(forMatch[1].trim());
  }

  const parenMatch = s.match(/^(.+?)\s*\([^)]+\)\s*$/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (inner && !/^service:/i.test(inner)) {
      return splitFullName(inner);
    }
  }

  const dashMatch = s.match(/^([^-]+?)\s*-\s*.+$/);
  if (dashMatch) {
    const inner = dashMatch[1].trim();
    if (inner.length >= 2 && !/^service:/i.test(inner)) {
      return splitFullName(inner);
    }
  }

  return { firstName: null, lastName: null };
}

/**
 * Pick the client/guest attendee (not the calendar owner or organizer).
 */
function pickGuestAttendee(event, ownerEmail) {
  const owner = (ownerEmail || '').toLowerCase();
  const organizerEmail = (event.organizer?.email || '').toLowerCase();
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];

  return attendees.find((a) => {
    const email = (a.email || '').toLowerCase();
    if (!email || a.resource) return false;
    if (a.self) return false;
    if (owner && email === owner) return false;
    if (organizerEmail && email === organizerEmail && a.organizer) return false;
    if (organizerEmail && email === organizerEmail && !a.organizer) {
      return attendees.filter((x) => x.email && !x.resource).length === 1;
    }
    if (organizerEmail && email === organizerEmail) return false;
    return true;
  }) || null;
}

/**
 * @param {object} event Google Calendar API event resource
 * @param {{ ownerEmail?: string }} context
 * @returns {{ eventType: string, contact: object, appointment: object } | null}
 */
const normalizeGoogleCalendarEvent = (event, context = {}) => {
  if (!event?.id) return null;

  const guest = pickGuestAttendee(event, context.ownerEmail);
  if (!guest?.email) {
    return null;
  }

  const startRaw = event.start?.dateTime || event.start?.date;
  if (!startRaw) return null;

  const email = guest.email.trim().toLowerCase();
  const displayName = (guest.displayName || '').trim();
  let firstName = null;
  let lastName = null;

  if (displayName) {
    const nameParts = displayName.split(/\s+/);
    firstName = nameParts[0] || null;
    lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
  } else {
    const fromSummary = parseNameFromSummary(event.summary);
    firstName = fromSummary.firstName;
    lastName = fromSummary.lastName;
  }

  const eventType = event.status === 'cancelled' ? 'booking.cancelled' : 'booking.created';

  return {
    eventType,
    contact: {
      firstName,
      lastName,
      phone: null,
      email,
    },
    appointment: {
      externalId: `gcal:${event.id}`,
      provider: 'google_calendar',
      scheduledAt: startRaw,
      timezone: event.start?.timeZone || event.timeZone || 'America/New_York',
      serviceName: event.summary || 'Appointment',
      durationMinutes: parseDurationMinutes(event),
      rawPayload: event,
    },
  };
};

module.exports = {
  normalizeGoogleCalendarEvent,
  pickGuestAttendee,
  parseNameFromSummary,
  splitFullName,
};
