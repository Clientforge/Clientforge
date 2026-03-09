/**
 * Calendly webhook adapter — normalizes Calendly payloads to canonical event format.
 *
 * Calendly sends: { event, payload: { invitee, event, ... } }
 * We output: { eventType, contact, appointment }
 */
const normalizeCalendlyPayload = (raw) => {
  const event = raw.event; // 'invitee.created' | 'invitee.canceled'
  const payload = raw.payload || raw;
  const rescheduled = payload.rescheduled === true;

  const invitee = payload.invitee || {};
  const evt = payload.event || invitee.event || {};

  // Invitee URI is the unique ID (e.g. https://api.calendly.com/scheduled_events/xxx/invitees/yyy)
  const externalId = invitee.uri || invitee.uuid || evt.uri || '';

  // Contact info — Calendly often has email, phone may be in questions_and_answers
  let phone = invitee.phone_number || invitee.phone;
  if (!phone && Array.isArray(invitee.questions_and_answers)) {
    const phoneQ = invitee.questions_and_answers.find(
      (q) => /phone|mobile|cell/i.test(q.question || '')
    );
    if (phoneQ) phone = phoneQ.answer;
  }
  // Fallback: use email as identifier if no phone (we'll need email for contact matching)
  const email = invitee.email || '';

  const name = invitee.name || '';
  const [firstName, ...lastParts] = name.trim().split(/\s+/);
  const lastName = lastParts.join(' ') || null;

  // Start time — can be on event or invitee
  const startTime = evt.start_time || invitee.start_time || invitee.event?.start_time;
  const timezone = invitee.timezone || evt.timezone || 'America/New_York';

  const serviceName = evt.name || invitee.event?.name || 'Appointment';
  const duration = evt.duration || invitee.event?.duration || 30;

  const contact = {
    firstName: firstName || null,
    lastName: lastName || null,
    phone: phone || null,
    email: email || null,
  };

  const appointment = {
    externalId,
    provider: 'calendly',
    scheduledAt: startTime,
    timezone,
    serviceName,
    durationMinutes: typeof duration === 'number' ? duration : parseInt(duration, 10) || 30,
    rawPayload: raw,
  };

  let eventType;
  if (event === 'invitee.created') {
    eventType = rescheduled ? 'booking.rescheduled' : 'booking.created';
  } else if (event === 'invitee.canceled') {
    eventType = 'booking.cancelled';
  } else {
    eventType = 'booking.unknown';
  }

  return {
    eventType,
    contact,
    appointment,
    rescheduled,
  };
};

module.exports = { normalizeCalendlyPayload };
