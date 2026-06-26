#!/usr/bin/env node
/**
 * Square adapter tests — run: node scripts/testSquareAdapter.js
 */
const {
  normalizeSquareBooking,
  resolveEventType,
  resolveServiceName,
} = require('../src/adapters/square.adapter');

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;

const booking = {
  id: 'x0cw6tzpjbuic5',
  customer_id: 'K48SGF7H116G59WZJRMYJNJKA8',
  start_at: '2021-12-15T17:00:00Z',
  status: 'ACCEPTED',
  appointment_segments: [{ service_variation_id: 'GUN7HNQBH7ZRARYZN52E7O4B', duration_minutes: 30 }],
};

const raw = { type: 'booking.created', merchant_id: 'ETCE8W0W8QDYP', event_id: 'test-event-1' };

const normalized = normalizeSquareBooking({
  raw,
  booking,
  customer: {
    given_name: 'Jane',
    family_name: 'Doe',
    phone_number: '+15551234567',
    email_address: 'jane@example.com',
  },
  serviceNames: ['Botox'],
});

if (!normalized) {
  console.log('✗ normalizeSquareBooking returned null');
  failed += 1;
} else {
  failed += check('eventType', normalized.eventType, 'booking.created');
  failed += check('firstName', normalized.contact.firstName, 'Jane');
  failed += check('phone', normalized.contact.phone, '+15551234567');
  failed += check('serviceName', normalized.appointment.serviceName, 'Botox');
  failed += check('externalId', normalized.appointment.externalId, 'square:x0cw6tzpjbuic5');
  failed += check('provider', normalized.appointment.provider, 'square');
}

failed += check('cancel event', resolveEventType('booking.updated', { status: 'CANCELLED' }), 'booking.cancelled');
failed += check('multi service', resolveServiceName(booking, ['Botox', 'Facial']), 'Botox, Facial');

console.log(failed === 0 ? '\nAll Square adapter tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
