/**
 * Google Calendar event → canonical booking event (same shape as Calendly / email adapters).
 */

const crypto = require('crypto');

function eventEndMs(event) {
  const endRaw = event?.end?.dateTime || event?.end?.date;
  if (!endRaw) return null;
  const endMs = new Date(endRaw).getTime();
  return Number.isNaN(endMs) ? null : endMs;
}

/** True when the event end time is at or before now (in-progress events are not past). */
function isPastGoogleEvent(event, nowMs = Date.now()) {
  const endMs = eventEndMs(event);
  if (endMs == null) return false;
  return endMs <= nowMs;
}

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
 * GlossGenius puts services in the event description, not the title.
 */
function parseServiceFromDescription(description) {
  if (!description || !String(description).trim()) return null;
  const firstLine = String(description).split('\n').map((l) => l.trim()).find(Boolean);
  if (!firstLine) return null;

  const segment = firstLine.split(',')[0].trim();
  const cleaned = segment
    .replace(/\s*\(GlossGenius[^)]*\)\s*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();

  return cleaned.length >= 2 ? cleaned : null;
}

function isFeedStyleBookingEvent(event) {
  const summary = event.summary || '';
  const description = event.description || '';
  if (/glossgenius/i.test(summary) || /glossgenius/i.test(description)) return true;
  if (/portrait care/i.test(summary) || /portrait care/i.test(description)) return true;
  const { firstName } = parseNameFromSummary(summary);
  return !!firstName;
}

function slugifyContactName(firstName, lastName) {
  const slug = [firstName, lastName]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug) return slug.slice(0, 80);
  return crypto.createHash('sha1').update(`${firstName}|${lastName}`).digest('hex').slice(0, 16);
}

function resolveServiceName(event, hasGuestEmail) {
  const summary = event.summary || '';
  if (!hasGuestEmail || /glossgenius/i.test(summary) || /glossgenius/i.test(event.description || '')) {
    const fromDesc = parseServiceFromDescription(event.description);
    if (fromDesc) return fromDesc;
  }
  return summary || 'Appointment';
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

  const startRaw = event.start?.dateTime || event.start?.date;
  if (!startRaw) return null;

  const guest = pickGuestAttendee(event, context.ownerEmail);
  const guestEmail = guest?.email?.trim().toLowerCase() || null;

  let firstName = null;
  let lastName = null;

  if (guest?.displayName?.trim()) {
    const nameParts = guest.displayName.trim().split(/\s+/);
    firstName = nameParts[0] || null;
    lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
  }

  const fromSummary = parseNameFromSummary(event.summary);
  if (!firstName) firstName = fromSummary.firstName;
  if (!lastName) lastName = fromSummary.lastName;

  if (!guestEmail) {
    if (!firstName || !isFeedStyleBookingEvent(event)) {
      return null;
    }
  }

  const eventType = event.status === 'cancelled' ? 'booking.cancelled' : 'booking.created';
  const contact = {
    firstName,
    lastName,
    phone: null,
    email: guestEmail,
  };

  if (!guestEmail && firstName) {
    contact.nameOnly = true;
    contact.syntheticPhone = `gcal-${slugifyContactName(firstName, lastName)}`;
  }

  return {
    eventType,
    contact,
    appointment: {
      externalId: `gcal:${event.id}`,
      provider: 'google_calendar',
      scheduledAt: startRaw,
      timezone: event.start?.timeZone || event.timeZone || 'America/New_York',
      serviceName: resolveServiceName(event, !!guestEmail),
      durationMinutes: parseDurationMinutes(event),
      rawPayload: event,
    },
  };
};

module.exports = {
  normalizeGoogleCalendarEvent,
  pickGuestAttendee,
  parseNameFromSummary,
  parseServiceFromDescription,
  splitFullName,
  isFeedStyleBookingEvent,
  isPastGoogleEvent,
  eventEndMs,
};
