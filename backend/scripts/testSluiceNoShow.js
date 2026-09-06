/**
 * Sluice no-show workflow helpers — run: node scripts/testSluiceNoShow.js
 */
const { normalizeConfig } = require('../src/services/appointment-automation.service');
const {
  SLUICE_NO_SHOW_SEND_HOUR,
  getLocalHour,
  getLocalDateKey,
} = require('../src/services/sluice-no-show.service');
const { SLUICE_TENANT_ID } = require('../src/config/sluiceTenant');

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

check('send hour is 7 PM', SLUICE_NO_SHOW_SEND_HOUR, 19);
checkCond('local hour is number', typeof getLocalHour('America/New_York'), 'number');
checkCond('local date key format', /^\d{4}-\d{2}-\d{2}$/.test(getLocalDateKey('America/New_York')), true);

const defaults = normalizeConfig(null);
check('default no-show enabled', defaults.event_messages.no_show.enabled, true);
checkCond('default no-show message mentions booking', defaults.event_messages.no_show.message.includes('{bookingLink}'));

const withNoShow = normalizeConfig({
  event_messages: {
    no_show: { enabled: false, message: 'Custom no-show text' },
  },
});
check('no-show disabled from config', withNoShow.event_messages.no_show.enabled, false);
check('no-show custom message', withNoShow.event_messages.no_show.message, 'Custom no-show text');

checkCond('Sluice tenant id is set', SLUICE_TENANT_ID.length > 0);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll Sluice no-show tests passed');
