#!/usr/bin/env node
/**
 * Campaign audience tag filter tests — run: node scripts/testCampaignAudienceTags.js
 */
const { normalizeAudienceTags, normalizeAudienceFilter, buildAudienceWhere } = require('../src/services/campaign.service');

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

check('legacy single tag', normalizeAudienceTags({ tag: 'vip' }), ['vip']);
check('multi tags', normalizeAudienceTags({ tags: ['a', 'b', 'a'] }), ['a', 'b']);
check('normalize filter', normalizeAudienceFilter({ tag: 'immune-defense-drip' }), { tags: ['immune-defense-drip'] });
check('empty filter', normalizeAudienceFilter({}), {});

const single = buildAudienceWhere('tenant-1', { tags: ['vip'] }, 'sms');
check('single tag uses containment', single.whereSql.includes('tags @>'), true);

const multi = buildAudienceWhere('tenant-1', { tags: ['a', 'b'] }, 'sms');
check('multi tag uses any match', multi.whereSql.includes('tags ?|'), true);
check('multi tag params', multi.params.includes('tenant-1') && multi.params.some((p) => Array.isArray(p) && p.includes('a')), true);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll campaign audience tag tests passed');
