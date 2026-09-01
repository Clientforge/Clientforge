#!/usr/bin/env node
/**
 * Auto shop master service classification smoke tests (no DB required).
 *   node scripts/testAutoShopClassification.js
 */

const {
  classifyByKeywords,
  classifyByFuzzy,
  scoreFuzzyMatch,
  excludeDeferredFromClassifications,
  DEFAULT_CATEGORY_SLUG,
  MASTER_CATEGORIES,
} = require('../src/services/auto-shop-classification.service');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.log(`✗ ${label}`);
    failed += 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

const keywordTests = [
  ['Synthetic Oil Change', 'routine_maintenance'],
  ['Front Brake Pad Replacement', 'brakes'],
  ['4 Wheel Alignment', 'tires_alignment'],
  ['Battery Test & Replace', 'battery_electrical'],
  ['A/C Recharge Service', 'ac_climate'],
  ['Transmission Fluid Exchange', 'transmission_drivetrain'],
  ['Front Strut Replacement', 'steering_suspension'],
  ['Coolant Flush & Fill', 'cooling_fluids'],
  ['Check Engine Light Diagnosis', 'diagnostics_inspections'],
  ['Random Shop Fee XYZ', null],
];

for (const [raw, expectedSlug] of keywordTests) {
  const result = classifyByKeywords(raw);
  const slug = result?.slug || null;
  assert(`keyword "${raw}" → ${expectedSlug || DEFAULT_CATEGORY_SLUG}`, slug === expectedSlug);
}

const fuzzyCandidates = [
  { serviceNameDisplay: 'Oil Change', masterCategoryId: 'cat-routine', categorySlug: 'routine_maintenance' },
  { serviceNameDisplay: 'Brake Pad Replacement', masterCategoryId: 'cat-brakes', categorySlug: 'brakes' },
];

assert('fuzzy "Full Synthetic Oil Change" → routine', classifyByFuzzy('Full Synthetic Oil Change', fuzzyCandidates)?.categoryId === 'cat-routine');
assert('fuzzy "Unknown Widget" → null', classifyByFuzzy('Unknown Widget', fuzzyCandidates) === null);
assert('score exact match > substring', scoreFuzzyMatch('oil change', 'oil change') > scoreFuzzyMatch('synthetic oil change service', 'oil change'));

assert('10 master categories defined', MASTER_CATEGORIES.length === 10);
assert('intervals include 60/90/180 days', MASTER_CATEGORIES.some((c) => c.followUpIntervalDays === 60)
  && MASTER_CATEGORIES.some((c) => c.followUpIntervalDays === 90)
  && MASTER_CATEGORIES.some((c) => c.followUpIntervalDays === 180));

assert('exclude deferred from maintenance list', excludeDeferredFromClassifications(
  [
    { serviceName: 'Tune-up', slug: 'diagnostics_inspections' },
    { serviceName: 'Oil Change', slug: 'routine_maintenance' },
  ],
  ['Tune-up'],
).length === 1);

process.exit(failed > 0 ? 1 : 0);
