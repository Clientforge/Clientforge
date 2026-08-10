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

function includes(label, sqlBundle, needle) {
  const haystack = `${sqlBundle.cteSql || ''} ${sqlBundle.whereSql}`;
  if (!haystack.includes(needle)) {
    console.error(`FAIL: ${label} — expected to include "${needle}" in ${haystack}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('legacy single tag', normalizeAudienceTags({ tag: 'vip' }), ['vip']);
check('multi tags', normalizeAudienceTags({ tags: ['a', 'b', 'a'] }), ['a', 'b']);
check('normalize filter', normalizeAudienceFilter({ tag: 'immune-defense-drip' }), { tags: ['immune-defense-drip'] });
check('normalize filter with last visit', normalizeAudienceFilter({ tags: ['a'], lastVisit: '90d' }), { tags: ['a'], lastVisit: '90d' });
check('normalize filter with 2yr inactive', normalizeAudienceFilter({ lastVisit: 'not730d' }), { lastVisit: 'not730d' });
check('normalize strips invalid last visit', normalizeAudienceFilter({ lastVisit: 'bogus' }), {});
check('empty filter', normalizeAudienceFilter({}), {});

const single = buildAudienceWhere('tenant-1', { tags: ['vip'] }, 'sms');
includes('single tag uses containment', single, 'tags @>');
check('no last visit uses contacts table', single.fromTable, 'contacts');

const multi = buildAudienceWhere('tenant-1', { tags: ['a', 'b'] }, 'sms');
includes('multi tag uses any match', multi, 'tags ?|');
check('multi tag params', multi.params.includes('tenant-1') && multi.params.some((p) => Array.isArray(p) && p.includes('a')), true);

const within90 = buildAudienceWhere('tenant-1', { lastVisit: '90d' }, 'sms');
includes('within 90d uses effective last visit', within90, "INTERVAL '90 days'");
includes('within 90d uses audience CTE', within90, 'audience_contacts');
check('within 90d fromTable', within90.fromTable, 'audience_contacts');

const not30 = buildAudienceWhere('tenant-1', { lastVisit: 'not30d' }, 'sms');
includes('not 30d includes null', not30, 'effective_last_at IS NULL');
includes('not 30d interval', not30, "INTERVAL '30 days'");

const not730 = buildAudienceWhere('tenant-1', { lastVisit: 'not730d' }, 'sms');
includes('not 730d (2 years)', not730, "INTERVAL '730 days'");

const combined = buildAudienceWhere('tenant-1', { tags: ['vip'], lastVisit: '120d' }, 'email');
includes('combined tags and visit', combined, 'tags @>');
includes('combined visit interval', combined, "INTERVAL '120 days'");

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll campaign audience tag tests passed');
