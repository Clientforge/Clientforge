#!/usr/bin/env node
/**
 * Quick parser smoke test — run: node scripts/testBookingEmailParse.js
 */
const fs = require('fs');
const path = require('path');
const { parseBookingEmail } = require('../src/services/bookingEmailParse.service');

const fixturePath = path.join(__dirname, 'fixtures/grace-to-grace-booking.txt');
const bodyText = fs.readFileSync(fixturePath, 'utf8');

const result = parseBookingEmail({
  subject: 'New appointment booked',
  fromAddress: 'notifications@example.com',
  bodyText,
});

const checks = [
  ['businessName', result.businessName, 'Grace To Grace Cash for Cars'],
  ['firstName', result.firstName, 'James'],
  ['lastName', result.lastName, 'Wells'],
  ['customerPhone', result.customerPhone, '240-382-7051'],
  ['scheduledAt', Boolean(result.scheduledAt), true],
  ['timezone', result.timezone, 'America/New_York'],
  ['confidence >= 0.55', result.confidence >= 0.55, true],
];

let failed = 0;
for (const [label, actual, expected] of checks) {
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log('\nAll checks passed.');
console.log('scheduledAt:', result.scheduledAt);
