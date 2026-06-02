/**
 * Tenant timezone helpers — run: node scripts/testTenantTimezone.js
 */
const { scheduledTodayInTimezone, formatTimeInTimezone } = require('../src/utils/tenantTimezone');

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected "${expected}", got "${actual}"`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('SQL clause', scheduledTodayInTimezone('a.scheduled_at', 3),
  "(a.scheduled_at AT TIME ZONE $3)::date = (NOW() AT TIME ZONE $3)::date");

// 2pm Eastern stored as UTC instant
const easternTwoPm = '2026-06-02T18:00:00.000Z';
check(
  'format in Eastern',
  formatTimeInTimezone(easternTwoPm, 'America/New_York'),
  new Date(easternTwoPm).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }),
);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tenant timezone tests passed');
