/**
 * Unit tests for Google Calendar event normalization.
 */
const { normalizeGoogleCalendarEvent } = require('../src/adapters/googleCalendar.adapter');

let failed = 0;

function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

const guestEvent = {
  id: 'evt123',
  status: 'confirmed',
  summary: 'Botox consult',
  start: { dateTime: '2026-06-01T14:00:00-04:00', timeZone: 'America/New_York' },
  end: { dateTime: '2026-06-01T14:30:00-04:00', timeZone: 'America/New_York' },
  organizer: { email: 'owner@spa.com', self: true },
  attendees: [
    { email: 'owner@spa.com', organizer: true, responseStatus: 'accepted' },
    { email: 'client@example.com', displayName: 'Jane Doe', responseStatus: 'accepted' },
  ],
};

const normalized = normalizeGoogleCalendarEvent(guestEvent, { ownerEmail: 'owner@spa.com' });
check('parses guest email', normalized?.contact?.email, 'client@example.com');
check('parses first name', normalized?.contact?.firstName, 'Jane');
check('external id prefix', normalized?.appointment?.externalId, 'gcal:evt123');
check('provider', normalized?.appointment?.provider, 'google_calendar');

const solo = normalizeGoogleCalendarEvent(
  { id: 'solo', summary: 'Block', start: { dateTime: '2026-06-01T14:00:00Z' }, end: { dateTime: '2026-06-01T15:00:00Z' }, attendees: [] },
  { ownerEmail: 'owner@spa.com' },
);
check('skips event without guest', solo, null);

const cancelled = normalizeGoogleCalendarEvent(
  { ...guestEvent, status: 'cancelled' },
  { ownerEmail: 'owner@spa.com' },
);
check('cancelled event type', cancelled?.eventType, 'booking.cancelled');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Google Calendar adapter tests passed');
