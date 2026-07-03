#!/usr/bin/env node
/**
 * Rebooking campaign planning tests — run: node scripts/testRebookingSchedule.js
 */
const automationService = require('../src/services/appointment-automation.service');
const { planRebookingCampaign } = require('../src/services/appointment-workflow.service');

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;
const referenceDate = new Date('2026-07-01T18:30:00.000Z');
const defaults = automationService.buildDefaultConfig();

failed += check(
  'service auto-rebook schedules initial + follow-ups',
  planRebookingCampaign({
    matched: {
      name: 'Age-defying Drip',
      rebookingEnabled: true,
      returnIntervalDays: 28,
      rebookMessage: '',
    },
    config: { ...defaults, rebooking: { ...defaults.rebooking, enabled: false } },
    referenceDate,
  }).items.filter((item) => item.message).length,
  3,
);

failed += check(
  'service auto-rebook uses return interval',
  planRebookingCampaign({
    matched: {
      name: 'Age-defying Drip',
      rebookingEnabled: true,
      returnIntervalDays: 28,
      rebookMessage: '',
    },
    config: defaults,
    referenceDate,
  }).offsetDays,
  28,
);

failed += check(
  'empty service rebook message falls back to default template',
  planRebookingCampaign({
    matched: {
      name: 'Age-defying Drip',
      rebookingEnabled: true,
      returnIntervalDays: 28,
      rebookMessage: '',
    },
    config: defaults,
    referenceDate,
  }).items[0].message.includes('{serviceName}'),
  true,
);

const autoRebookOff = planRebookingCampaign({
  matched: {
    name: 'Age-defying Drip',
    rebookingEnabled: false,
    returnIntervalDays: 28,
  },
  config: { ...defaults, rebooking: { ...defaults.rebooking, enabled: false } },
  referenceDate,
});
failed += check('auto-rebook off skips with reason', autoRebookOff.offsetDays, null);
failed += check('auto-rebook off explains why', autoRebookOff.skipReason.includes('auto-rebook'), true);

const genericOnly = planRebookingCampaign({
  matched: null,
  config: { ...defaults, rebooking: { ...defaults.rebooking, enabled: true } },
  referenceDate,
});
failed += check('generic rebooking when workflow enabled', genericOnly.source, 'generic');
failed += check('generic rebooking schedules items', genericOnly.items.length, 3);

const stringInterval = planRebookingCampaign({
  matched: {
    name: 'Age-defying Drip',
    rebookingEnabled: true,
    returnIntervalDays: '28',
    rebookMessage: '',
  },
  config: { ...defaults, rebooking: { ...defaults.rebooking, enabled: false } },
  referenceDate,
});
failed += check('string return interval coerces to number', stringInterval.offsetDays, 28);
failed += check('string return interval schedules jobs', stringInterval.items.length, 3);

const serviceCampaign = planRebookingCampaign({
  matched: {
    name: 'Emsculpt',
    rebookingEnabled: true,
    followUpCampaigns: [
      { id: 'a', enabled: true, intervalDays: 7, message: 'Day 7 check-in {firstName}' },
      { id: 'b', enabled: true, intervalDays: 30, message: 'Day 30 rebook {serviceName}' },
      { id: 'c', enabled: false, intervalDays: 60, message: 'Skipped' },
    ],
  },
  config: defaults,
  referenceDate,
  serviceFollowupCampaignsEnabled: true,
});
failed += check('service campaigns source', serviceCampaign.source, 'service_campaign');
failed += check('service campaigns schedules enabled steps only', serviceCampaign.items.length, 2);
failed += check('service campaigns first interval', serviceCampaign.offsetDays, 7);
failed += check(
  'service campaigns days from visit',
  serviceCampaign.items[1].runAt.toISOString().slice(0, 10),
  '2026-07-31',
);
failed += check('service campaigns uses custom message', serviceCampaign.items[0].message, 'Day 7 check-in {firstName}');

const campaignFlagOff = planRebookingCampaign({
  matched: {
    name: 'Emsculpt',
    rebookingEnabled: true,
    returnIntervalDays: 28,
    followUpCampaigns: [{ id: 'a', enabled: true, intervalDays: 7, message: 'Campaign only' }],
  },
  config: { ...defaults, rebooking: { ...defaults.rebooking, enabled: false } },
  referenceDate,
  serviceFollowupCampaignsEnabled: false,
});
failed += check('campaigns ignored when tenant flag off', campaignFlagOff.source, 'service');
failed += check('legacy return interval used when flag off', campaignFlagOff.offsetDays, 28);
failed += check('legacy initial message not campaign message', campaignFlagOff.items[0].message.includes('Campaign only'), false);

console.log(failed === 0 ? '\nAll rebooking schedule tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
