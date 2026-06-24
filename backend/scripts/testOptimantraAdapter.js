#!/usr/bin/env node
/**
 * OptiMantra adapter tests — run: node scripts/testOptimantraAdapter.js
 *
 * Replace fixtures/optimantra-sample-booking.json with the client's real payload when available.
 */
const fs = require('fs');
const path = require('path');
const {
  normalizeOptimantraPayload,
  parseScheduledAt,
  resolveEventType,
  resolveExternalId,
} = require('../src/adapters/optimantra.adapter');

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;

const fixturePath = path.join(__dirname, '../fixtures/optimantra-sample-booking.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

failed += check(
  'parseScheduledAt (OptiMantra apptDate)',
  parseScheduledAt('Wed Jun 11 2025 09:00:00 GMT-0400 (Eastern Daylight Time)'),
  '2025-06-11T13:00:00.000Z',
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
  failed += check('fixture phone', normalized.contact.phone, '5555550100');
  failed += check('fixture email', normalized.contact.email, 'test@example.com');
  failed += check('fixture firstName', normalized.contact.firstName, 'Test');
  failed += check('fixture serviceName', normalized.appointment.serviceName, 'Botox');
  failed += check('fixture externalId', normalized.appointment.externalId, 'optimantra:12345');
  failed += check('fixture provider', normalized.appointment.provider, 'optimantra');
  failed += check(
    'fixture scheduledAt',
    normalized.appointment.scheduledAt,
    '2025-06-11T13:00:00.000Z',
  );
}

console.log(failed === 0 ? '\nAll OptiMantra adapter tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
