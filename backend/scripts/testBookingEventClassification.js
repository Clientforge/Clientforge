#!/usr/bin/env node
/**
 * Event classification tests — run: node scripts/testBookingEventClassification.js
 */
const { resolveEventTypeFromExisting } = require('../src/services/appointment.service');

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;

// First-time booking: parser says rescheduled but no prior appointment
const firstTime = resolveEventTypeFromExisting('booking.rescheduled', {
  scheduledAt: '2026-06-06T00:30:00.000Z',
  serviceName: 'Daxxify Tox',
  priorByExternalId: null,
  priorByContact: [],
});
failed += check('first-time → booking.created', firstTime.eventType, 'booking.created');
failed += check('first-time → no existing id', firstTime.existingAppointmentId, null);

// True reschedule: contact has prior appointment at different time
const trueReschedule = resolveEventTypeFromExisting('booking.rescheduled', {
  scheduledAt: '2026-06-06T00:30:00.000Z',
  serviceName: 'Daxxify Tox',
  priorByExternalId: null,
  priorByContact: [{
    id: 'appt-1',
    scheduled_at: '2026-06-01T18:00:00.000Z',
    service_name: 'Daxxify Tox',
    status: 'scheduled',
  }],
});
failed += check('true reschedule → booking.rescheduled', trueReschedule.eventType, 'booking.rescheduled');
failed += check('true reschedule → updates existing', trueReschedule.existingAppointmentId, 'appt-1');

// Same time duplicate email: not a reschedule
const duplicate = resolveEventTypeFromExisting('booking.rescheduled', {
  scheduledAt: '2026-06-06T00:30:00.000Z',
  serviceName: 'Daxxify Tox',
  priorByExternalId: null,
  priorByContact: [{
    id: 'appt-2',
    scheduled_at: '2026-06-06T00:30:00.000Z',
    service_name: 'Daxxify Tox',
    status: 'scheduled',
  }],
});
failed += check('same time → booking.created', duplicate.eventType, 'booking.created');

// Calendly-style: same external id, time changed
const calendly = resolveEventTypeFromExisting('booking.rescheduled', {
  scheduledAt: '2026-06-06T00:30:00.000Z',
  serviceName: 'Consultation',
  priorByExternalId: {
    id: 'appt-3',
    scheduled_at: '2026-06-01T18:00:00.000Z',
    service_name: 'Consultation',
    status: 'scheduled',
  },
  priorByContact: [],
});
failed += check('external id time change → rescheduled', calendly.eventType, 'booking.rescheduled');

// Different service: treat as new booking
const differentService = resolveEventTypeFromExisting('booking.rescheduled', {
  scheduledAt: '2026-06-06T00:30:00.000Z',
  serviceName: 'Fillers',
  priorByExternalId: null,
  priorByContact: [{
    id: 'appt-4',
    scheduled_at: '2026-06-01T18:00:00.000Z',
    service_name: 'Daxxify Tox',
    status: 'scheduled',
  }],
});
failed += check('different service → booking.created', differentService.eventType, 'booking.created');

// booking.created unchanged
const created = resolveEventTypeFromExisting('booking.created', {
  scheduledAt: '2026-06-06T00:30:00.000Z',
  serviceName: 'Tox',
  priorByExternalId: null,
  priorByContact: [],
});
failed += check('booking.created passthrough', created.eventType, 'booking.created');

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log('\nAll classification checks passed.');
