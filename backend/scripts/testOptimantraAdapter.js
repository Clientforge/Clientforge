#!/usr/bin/env node
/**
 * OptiMantra adapter tests — run: node scripts/testOptimantraAdapter.js
 */
const fs = require('fs');
const path = require('path');
const {
  normalizeOptimantraPayload,
  parseScheduledAt,
  resolveScheduledAt,
  resolveEventType,
  resolveExternalId,
} = require('../src/adapters/optimantra.adapter');

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

function checkStartsWith(label, actual, prefix) {
  const ok = String(actual).startsWith(prefix);
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected prefix ${JSON.stringify(prefix)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;

const fixturePath = path.join(__dirname, '../fixtures/optimantra-sample-booking.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

failed += check(
  'parseScheduledAt (GMT offset format)',
  parseScheduledAt('Wed Jun 11 2025 09:00:00 GMT-0400 (Eastern Daylight Time)'),
  '2025-06-11T13:00:00.000Z',
);

failed += check(
  'parseScheduledAt (Thu Jun 25 20:00:00 2026)',
  parseScheduledAt('Thu Jun 25 20:00:00 2026'),
  new Date('Thu Jun 25 20:00:00 2026').toISOString(),
);

failed += check(
  'resolveScheduledAt (date + apptStartTime)',
  resolveScheduledAt({ apptDate: 'Thu Jun 25 2026', apptStartTime: '20:00' }),
  (() => {
    const d = new Date('Thu Jun 25 2026');
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
  })(),
);

failed += check('resolveExternalId', resolveExternalId({ appointmentId: '12345' }), 'optimantra:12345');
failed += check('resolveEventType default', resolveEventType({}), 'booking.created');
failed += check('resolveEventType cancel', resolveEventType({ status: 'Cancelled' }), 'booking.cancelled');
failed += check('resolveEventType reschedule', resolveEventType({ trigger: 'Appointment Rescheduled' }), 'booking.rescheduled');

const normalized = normalizeOptimantraPayload(fixture);
if (!normalized) {
  console.log('✗ normalizeOptimantraPayload returned null');
  failed += 1;
} else {
  failed += check('fixture eventType', normalized.eventType, 'booking.created');
  failed += check('fixture phone', normalized.contact.phone, '111-111-1111');
  failed += check('fixture email', normalized.contact.email, 'mark@optimantra.com');
  failed += check('fixture firstName', normalized.contact.firstName, 'test');
  failed += check('fixture lastName', normalized.contact.lastName, 'optimantra');
  failed += check('fixture serviceName (default)', normalized.appointment.serviceName, 'Appointment');
  failed += checkStartsWith('fixture externalId (hash fallback)', normalized.appointment.externalId, 'optimantra:');
  failed += check('fixture provider', normalized.appointment.provider, 'optimantra');
  failed += check(
    'fixture scheduledAt',
    normalized.appointment.scheduledAt,
    new Date('Thu Jun 25 20:00:00 2026').toISOString(),
  );
}

console.log(failed === 0 ? '\nAll OptiMantra adapter tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
