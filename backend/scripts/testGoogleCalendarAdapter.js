/**
 * Unit tests for Google Calendar event normalization.
 */
const {
  normalizeGoogleCalendarEvent,
  parseNameFromSummary,
  parseServiceFromDescription,
  isPastGoogleEvent,
} = require('../src/adapters/googleCalendar.adapter');

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
check('parses last name from displayName', normalized?.contact?.lastName, 'Doe');
check('external id prefix', normalized?.appointment?.externalId, 'gcal:evt123');
check('provider', normalized?.appointment?.provider, 'google_calendar');

const solo = normalizeGoogleCalendarEvent(
  { id: 'solo', summary: 'Block', start: { dateTime: '2026-06-01T14:00:00Z' }, end: { dateTime: '2026-06-01T15:00:00Z' }, attendees: [] },
  { ownerEmail: 'owner@spa.com' },
);
check('skips event without guest or title name', solo, null);

const cancelled = normalizeGoogleCalendarEvent(
  { ...guestEvent, status: 'cancelled' },
  { ownerEmail: 'owner@spa.com' },
);
check('cancelled event type', cancelled?.eventType, 'booking.cancelled');

const glossGenius = normalizeGoogleCalendarEvent(
  {
    id: 'gg1',
    status: 'confirmed',
    summary: 'Dacia Barton (GlossGenius Appointment)',
    description: 'Tox Treatments (Daxxify), Fillers (GlossGenius Event)',
    start: { dateTime: '2026-06-01T13:00:00-04:00', timeZone: 'America/New_York' },
    end: { dateTime: '2026-06-01T15:30:00-04:00', timeZone: 'America/New_York' },
    organizer: { email: 'owner@spa.com', self: true },
    attendees: [{ email: 'owner@spa.com', organizer: true }],
  },
  { ownerEmail: 'owner@spa.com' },
);
check('GlossGenius no guest — first name', glossGenius?.contact?.firstName, 'Dacia');
check('GlossGenius no guest — last name', glossGenius?.contact?.lastName, 'Barton');
check('GlossGenius no guest — no email', glossGenius?.contact?.email, null);
check('GlossGenius synthetic phone', glossGenius?.contact?.syntheticPhone, 'gcal-dacia-barton');
check('GlossGenius service from description', glossGenius?.appointment?.serviceName, 'Tox Treatments');

const portraitCare = normalizeGoogleCalendarEvent(
  {
    id: 'pc1',
    status: 'confirmed',
    summary: 'Service: Daxxify Tox for Akintunde Akinniyi',
    start: { dateTime: '2026-06-02T12:30:00-04:00', timeZone: 'America/New_York' },
    end: { dateTime: '2026-06-02T13:00:00-04:00', timeZone: 'America/New_York' },
    organizer: { email: 'owner@spa.com', self: true },
    attendees: [
      { email: 'owner@spa.com', organizer: true },
      { email: 'e-t_akinniyi@yahoo.com', responseStatus: 'accepted' },
    ],
  },
  { ownerEmail: 'owner@spa.com' },
);
check('Portrait Care for-clause first name', portraitCare?.contact?.firstName, 'Akintunde');
check('Portrait Care for-clause last name', portraitCare?.contact?.lastName, 'Akinniyi');

const fromSummary = parseNameFromSummary('Jane Smith - Botox');
check('dash title first name', fromSummary.firstName, 'Jane');
check('dash title last name', fromSummary.lastName, 'Smith');

const fromDesc = parseServiceFromDescription('Tox Treatments (Daxxify), Fillers (GlossGenius Event)');
check('description service parse', fromDesc, 'Tox Treatments');

const displayNameWins = normalizeGoogleCalendarEvent(
  {
    ...guestEvent,
    id: 'dn1',
    summary: 'Ignored Name (GlossGenius Appointment)',
    attendees: [
      { email: 'owner@spa.com', organizer: true },
      { email: 'client@example.com', displayName: 'Jane Doe', responseStatus: 'accepted' },
    ],
  },
  { ownerEmail: 'owner@spa.com' },
);
check('displayName preferred over title', displayNameWins?.contact?.firstName, 'Jane');

const now = new Date('2026-06-01T15:00:00-04:00').getTime();
check(
  'past event (ended)',
  isPastGoogleEvent(
    {
      end: { dateTime: '2026-06-01T14:30:00-04:00' },
    },
    now,
  ),
  true,
);
check(
  'in-progress event',
  isPastGoogleEvent(
    {
      end: { dateTime: '2026-06-01T15:30:00-04:00' },
    },
    now,
  ),
  false,
);
check(
  'future event',
  isPastGoogleEvent(
    {
      end: { dateTime: '2026-06-10T10:00:00-04:00' },
    },
    now,
  ),
  false,
);
check('missing end is not past', isPastGoogleEvent({}, now), false);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Google Calendar adapter tests passed');
