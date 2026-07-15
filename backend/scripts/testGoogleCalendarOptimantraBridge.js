#!/usr/bin/env node
/**
 * Sluice Google Calendar → OptiMantra bridge tests.
 * Run: node scripts/testGoogleCalendarOptimantraBridge.js
 */
const {
  classifyCalendarChange,
  parseEventStartMs,
  SAME_TIME_MS,
} = require('../src/services/googleCalendarOptimantraBridge.service');
const { isSluiceTenant, SLUICE_TENANT_ID } = require('../src/config/sluiceTenant');

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;

failed += check('Sluice tenant id is set', typeof SLUICE_TENANT_ID, 'string');
failed += check('isSluiceTenant true for Sluice', isSluiceTenant(SLUICE_TENANT_ID), true);
failed += check('isSluiceTenant false for others', isSluiceTenant('00000000-0000-0000-0000-000000000000'), false);

const baseAppt = {
  id: 'appt-1',
  scheduled_at: '2026-07-14T18:00:00.000Z',
  status: 'scheduled',
};

failed += check(
  'cancelled calendar event',
  classifyCalendarChange({ status: 'cancelled', start: { dateTime: '2026-07-14T18:00:00.000Z' } }, baseAppt),
  'booking.cancelled',
);

failed += check(
  'same time → unchanged',
  classifyCalendarChange(
    { status: 'confirmed', start: { dateTime: '2026-07-14T18:00:00.000Z' } },
    baseAppt,
  ),
  'booking.unchanged',
);

failed += check(
  'within 1 min → unchanged',
  classifyCalendarChange(
    { status: 'confirmed', start: { dateTime: new Date(new Date(baseAppt.scheduled_at).getTime() + SAME_TIME_MS - 1000).toISOString() } },
    baseAppt,
  ),
  'booking.unchanged',
);

failed += check(
  'time moved → rescheduled',
  classifyCalendarChange(
    { status: 'confirmed', start: { dateTime: '2026-07-21T18:00:00.000Z' } },
    baseAppt,
  ),
  'booking.rescheduled',
);

const parsed = parseEventStartMs({ start: { dateTime: '2026-07-14T18:00:00.000Z' } });
failed += check('parseEventStartMs', parsed, new Date('2026-07-14T18:00:00.000Z').getTime());

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log('\nAll Sluice calendar bridge checks passed.');
