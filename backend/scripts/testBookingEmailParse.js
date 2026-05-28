#!/usr/bin/env node
/**
 * Parser smoke tests — run: npm test (from backend/)
 * Uses TZ=UTC to match Render production server behavior.
 */
process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
const { parseBookingEmail } = require('../src/services/bookingEmailParse.service');
const { buildTemplateVars, renderTemplate } = require('../src/services/appointment-automation.service');

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

function runChecks(title, result, checks) {
  console.log(`\n— ${title}`);
  let failed = 0;
  for (const [label, actual, expected] of checks) {
    const ok = actual === expected;
    console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
    if (!ok) failed += 1;
  }
  if (failed > 0) {
    console.error(JSON.stringify(result, null, 2));
  }
  return failed;
}

let totalFailed = 0;

const grace = parseBookingEmail({
  subject: 'New appointment booked',
  fromAddress: 'notifications@example.com',
  bodyText: loadFixture('grace-to-grace-booking.txt'),
});

totalFailed += runChecks('Grace To Grace booking', grace, [
  ['businessName', grace.businessName, 'Grace To Grace Cash for Cars'],
  ['firstName', grace.firstName, 'James'],
  ['lastName', grace.lastName, 'Wells'],
  ['scheduledAt', grace.scheduledAt, '2026-06-01T18:00:00.000Z'],
  ['timezone', grace.timezone, 'America/New_York'],
  ['confidence >= 0.55', grace.confidence >= 0.55, true],
]);

const cherished = parseBookingEmail({
  subject: 'Appointment rescheduled',
  fromAddress: 'notifications@example.com',
  bodyText: loadFixture('cherished-reschedule.txt'),
});

totalFailed += runChecks('Cherished Aesthetics reschedule (8:30 PM EST)', cherished, [
  ['businessName', cherished.businessName, 'Cherished Aesthetics PC'],
  ['eventType', cherished.eventType, 'booking.rescheduled'],
  ['serviceName', cherished.serviceName, 'Daxxify Tox'],
  ['scheduledAt', cherished.scheduledAt, '2026-06-06T00:30:00.000Z'],
  ['timezone', cherished.timezone, 'America/New_York'],
]);

const vars = buildTemplateVars({
  tenant: { name: 'Cherished Aesthetics PC', timezone: 'America/New_York' },
  contact: { first_name: 'Tunde', last_name: 'Akin' },
  appointment: {
    scheduled_at: cherished.scheduledAt,
    timezone: cherished.timezone,
    service_name: cherished.serviceName,
  },
});

const smsTime = renderTemplate('{appointmentTime}', vars);
console.log('\n— SMS template time');
const timeOk = smsTime === '8:30 PM';
console.log(`${timeOk ? '✓' : '✗'} appointmentTime in SMS: ${JSON.stringify(smsTime)}${timeOk ? '' : ' (expected "8:30 PM")'}`);
if (!timeOk) totalFailed += 1;

if (totalFailed > 0) {
  console.error(`\n${totalFailed} check(s) failed`);
  process.exit(1);
}

console.log('\nAll checks passed.');
