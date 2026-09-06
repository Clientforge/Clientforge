/**
 * Birthday campaign config + date helpers — run: node scripts/testBirthdayCampaign.js
 */
const {
  normalizeConfig,
  getLocalDateTimeParts,
  getWeekRange,
  getMonthStartKey,
  parseDateOfBirthParts,
  birthdayOccurrenceInWeek,
  resolveBirthdayCampaignRun,
  buildTemplateVars,
} = require('../src/services/birthday-campaign.service');
const { SLUICE_TENANT_ID } = require('../src/config/sluiceTenant');
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

function checkCond(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
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

const week = getWeekRange('America/New_York');
checkCond('week has 7 days', week.days.length === 7);
checkCond('week start before end', week.weekStart <= week.weekEnd);
checkCond('week includes today', week.days.some((d) => d.dateKey === week.todayKey));

const occurrence = birthdayOccurrenceInWeek('1990-05-20', week.days, week.calendarYear);
if (week.days.some((d) => d.month === 5 && d.day === 20)) {
  checkCond('birthday occurrence in week', occurrence === `${week.calendarYear}-05-20`);
} else {
  check('birthday occurrence outside week', occurrence, null);
}

const rendered = renderTemplate(
  'Happy Birthday {firstName}! — {businessName}',
  buildTemplateVars({
    tenant: { name: 'Sluice Drip Spa', booking_link: 'https://book.example.com' },
    contact: { first_name: 'Lola', last_name: 'Peterson' },
  }),
);
check('template render', rendered, 'Happy Birthday Lola! — Sluice Drip Spa');

check(
  'reviewLink falls back to booking link',
  buildTemplateVars({
    tenant: { name: 'Test', booking_link: 'https://book.example.com' },
    contact: { first_name: 'A' },
  }).reviewLink,
  'https://book.example.com',
);

check('parseDateOfBirthParts', parseDateOfBirthParts('1990-07-15'), { month: 7, day: 15 });
check('month start key', getMonthStartKey(2026, 3), '2026-03-01');

const sluiceMidMonth = resolveBirthdayCampaignRun({
  tenantId: SLUICE_TENANT_ID,
  local: { year: 2026, month: 3, day: 15, dateKey: '2026-03-15' },
});
check('Sluice skips mid-month', sluiceMidMonth.skip, true);
check('Sluice mid-month reason', sluiceMidMonth.reason, 'not_first_of_month');

const sluiceFirst = resolveBirthdayCampaignRun({
  tenantId: SLUICE_TENANT_ID,
  local: { year: 2026, month: 3, day: 1, dateKey: '2026-03-01' },
});
check('Sluice runs on 1st', sluiceFirst.skip, false);
check('Sluice monthly mode', sluiceFirst.mode, 'month_start');
check('Sluice run date is month start', sluiceFirst.runDate, '2026-03-01');
check('Sluice matches month only', sluiceFirst.month, 3);
checkCond('Sluice has no day filter', sluiceFirst.day === undefined);

const otherTenant = resolveBirthdayCampaignRun({
  tenantId: '00000000-0000-0000-0000-000000000000',
  local: { year: 2026, month: 3, day: 15, dateKey: '2026-03-15' },
});
check('Other tenants run daily', otherTenant.skip, false);
check('Other tenants exact-day mode', otherTenant.mode, 'on_birthday');
check('Other tenants use today as run date', otherTenant.runDate, '2026-03-15');
check('Other tenants match day', otherTenant.day, 15);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll birthday campaign tests passed');
