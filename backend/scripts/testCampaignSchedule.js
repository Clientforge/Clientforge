/**
 * Campaign schedule (tenant timezone) — run: node scripts/testCampaignSchedule.js
 */
const {
  computeWaveScheduledAt,
  parseSendTime,
  zonedTimeToUtc,
} = require('../src/utils/campaignSchedule');

let failed = 0;

function check(label, condition) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('parseSendTime HH:MM', parseSendTime('10:30')?.hour === 10 && parseSendTime('10:30')?.minute === 30);
check('parseSendTime invalid', parseSendTime('25:00') === null);

const tz = 'America/New_York';
const launch = new Date('2026-06-02T15:00:00.000Z'); // 11:00 AM EDT

const sameDay = computeWaveScheduledAt({
  launchedAt: launch,
  delayDays: 0,
  sendTime: '14:00',
  timezone: tz,
});
check(
  'delay 0 schedules later same local day',
  sameDay.toISOString() === '2026-06-02T18:00:00.000Z',
);

const immediatePast = computeWaveScheduledAt({
  launchedAt: launch,
  delayDays: 0,
  sendTime: '09:00',
  timezone: tz,
});
check(
  'delay 0 past send time sends at launch',
  immediatePast.getTime() === launch.getTime(),
);

const dayThree = computeWaveScheduledAt({
  launchedAt: launch,
  delayDays: 3,
  sendTime: '10:00',
  timezone: tz,
});
check(
  'delay 3 at 10:00 local',
  dayThree.toISOString() === '2026-06-05T14:00:00.000Z',
);

const legacy = computeWaveScheduledAt({
  launchedAt: launch,
  delayDays: 2,
  sendTime: null,
  timezone: tz,
});
check(
  'legacy no send_time uses 24h blocks',
  legacy.getTime() === launch.getTime() + 2 * 24 * 60 * 60 * 1000,
);

const utcTenAm = zonedTimeToUtc({
  year: 2026,
  month: 3,
  day: 8,
  hour: 10,
  minute: 0,
}, tz);
check(
  'DST spring forward day',
  utcTenAm.toISOString() === '2026-03-08T14:00:00.000Z',
);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll campaign schedule tests passed');
