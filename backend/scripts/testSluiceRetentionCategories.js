#!/usr/bin/env node
/**
 * Sluice retention category tests — run: node scripts/testSluiceRetentionCategories.js
 */
const {
  RETENTION_BUCKETS,
  SLUICE_SERVICE_CATEGORIES,
  IV_HYDRATION_TAG_SLUGS,
  getCategory,
  appointmentMatchesCategory,
} = require('../src/config/sluiceRetentionCategories');

let failed = 0;
function check(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('4 retention buckets', RETENTION_BUCKETS.length === 4);
check('bucket keys', RETENTION_BUCKETS.map((b) => b.key).join(',') === 'not30d,not90d,not120d,not365d');
check('4 service categories', SLUICE_SERVICE_CATEGORIES.length === 4);
check('IV hydration tag slugs', IV_HYDRATION_TAG_SLUGS.length >= 18);
check('immune-defense-drip slug', IV_HYDRATION_TAG_SLUGS.includes('immune-defense-drip'));
check('IV drip appointment match', appointmentMatchesCategory('Immune Defense Drip', 'iv-hydration'));
check('premium drip excluded from IV', !appointmentMatchesCategory('Premium Drip Package', 'iv-hydration'));
check('emsculpt match', appointmentMatchesCategory('EmSculpt Neo Consultation Visit', 'emsculpt'));
check('emsella match', appointmentMatchesCategory('EmSella Session', 'emsella'));
check('getCategory all', getCategory('all').key === 'all');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Sluice retention category tests passed');
