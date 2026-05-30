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
      // Guest might be marked organizer on some shared calendars — still allow if only attendee
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
  const nameParts = displayName ? displayName.split(/\s+/) : [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  const cancelled = event.status === 'cancelled';
  let eventType = 'booking.created';
  if (cancelled) {
    eventType = 'booking.cancelled';
  } else if (event.updated && event.created && event.updated !== event.created) {
    eventType = 'booking.rescheduled';
  }

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

module.exports = { normalizeGoogleCalendarEvent, pickGuestAttendee };
