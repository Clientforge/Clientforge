/**
 * Sluice cancellation follow-up (24h delay) — run: node scripts/testSluiceCancellationFollowup.js
 */
const {
  SLUICE_CANCELLATION_FOLLOWUP_HOURS,
  CANCELLATION_FOLLOWUP_JOB_TYPE,
  computeCancellationFollowUpAt,
} = require('../src/services/appointment-workflow.service');

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label} — expected ${e}, got ${a}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

function checkCond(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('follow-up delay is 24 hours', SLUICE_CANCELLATION_FOLLOWUP_HOURS, 24);
check('job type', CANCELLATION_FOLLOWUP_JOB_TYPE, 'cancellation_followup');

const cancelledAt = new Date('2026-09-10T15:30:00.000Z');
const followUpAt = computeCancellationFollowUpAt(cancelledAt);
checkCond(
  'follow-up is 24h after cancel',
  followUpAt.getTime() - cancelledAt.getTime() === 24 * 60 * 60 * 1000,
);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll Sluice cancellation follow-up tests passed');
