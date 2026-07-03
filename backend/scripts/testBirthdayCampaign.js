/**
 * Birthday campaign config + date helpers — run: node scripts/testBirthdayCampaign.js
 */
const {
  normalizeConfig,
  getLocalDateTimeParts,
  buildTemplateVars,
} = require('../src/services/birthday-campaign.service');
const { renderTemplate } = require('../src/services/appointment-automation.service');

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

const defaults = normalizeConfig(null);
check('default disabled', defaults.enabled, false);
check('default send hour', defaults.send_hour, 9);

const enabled = normalizeConfig({ enabled: true, sendHour: 14, message: 'Hi {firstName}!' });
check('enabled flag', enabled.enabled, true);
check('send hour from camelCase', enabled.send_hour, 14);
check('custom message', enabled.message, 'Hi {firstName}!');

const parts = getLocalDateTimeParts('America/New_York');
check('local parts has year', typeof parts.year, 'number');
check('local parts has dateKey format', /^\d{4}-\d{2}-\d{2}$/.test(parts.dateKey), true);

const rendered = renderTemplate(
  'Happy Birthday {firstName}! — {businessName}',
  buildTemplateVars({
    tenant: { name: 'Sluice Drip Spa', booking_link: 'https://book.example.com' },
    contact: { first_name: 'Lola', last_name: 'Peterson' },
  }),
);
check('template render', rendered, 'Happy Birthday Lola! — Sluice Drip Spa');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll birthday campaign tests passed');
