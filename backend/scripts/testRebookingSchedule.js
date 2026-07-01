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

console.log(failed === 0 ? '\nAll rebooking schedule tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
