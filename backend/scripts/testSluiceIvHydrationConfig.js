#!/usr/bin/env node
/**
 * Sluice IV Hydration config tests — run: node scripts/testSluiceIvHydrationConfig.js
 */
const {
  SLUICE_IV_DRIP_SERVICE_NAMES,
  isSluiceIvDripServiceName,
  mergeSluiceIvHydrationServices,
  buildIvHydrationService,
} = require('./sluiceIvHydrationConfig');

let failed = 0;
function check(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('18 drip names', SLUICE_IV_DRIP_SERVICE_NAMES.length === 18);
check('detects Immune Defense Drip', isSluiceIvDripServiceName('Immune Defense Drip'));
check('detects Beauty double-space drip', isSluiceIvDripServiceName('Beauty  Drip'));
check('rejects Premium Drip Package', !isSluiceIvDripServiceName('Premium Drip Package'));

const iv = buildIvHydrationService();
check('IV Hydration has 19 aliases minimum', iv.aliases.length >= 19);
check('IV Hydration has 3 follow-ups', iv.followUpCampaigns.length === 3);
check('follow-up intervals 4/10/20', iv.followUpCampaigns.map((s) => s.intervalDays).join(',') === '4,10,20');

const merged = mergeSluiceIvHydrationServices([
  { name: 'Immune Defense Drip', rebookingEnabled: true, followUpCampaigns: [{ intervalDays: 7 }], aliases: [] },
  { name: 'EmSculpt', rebookingEnabled: true, followUpCampaigns: [], aliases: [] },
]);
check('merge keeps EmSculpt', merged.some((s) => s.name === 'EmSculpt'));
check('merge disables standalone Immune Defense Drip', merged.find((s) => s.name === 'Immune Defense Drip')?.rebookingEnabled === false);
check('merge adds IV Hydration first', merged[0].name === 'IV Hydration');
check('merge adds Premium Drip Package', merged.some((s) => s.name === 'Premium Drip Package'));

// Service match simulation (scoreServiceMatch is not exported - use match via row shape)
const ivRow = { name: iv.name, aliases: iv.aliases };
const { normalizeServiceName } = require('./sluiceIvHydrationConfig');

function scoreServiceMatch(rawName, serviceRow) {
  const rawNorm = normalizeServiceName(rawName);
  if (!rawNorm) return 0;
  const candidates = [serviceRow.name, ...(serviceRow.aliases || [])];
  let best = 0;
  for (const candidate of candidates) {
    const candNorm = normalizeServiceName(candidate);
    if (!candNorm) continue;
    if (rawNorm === candNorm) best = Math.max(best, 100 + candNorm.length);
    else if (rawNorm.includes(candNorm) || candNorm.includes(rawNorm)) {
      best = Math.max(best, 50 + Math.min(rawNorm.length, candNorm.length));
    }
  }
  return best;
}

check('matches Detox Drip checkout', scoreServiceMatch('Detox Drip', ivRow) >= 100);
check('matches IV Hydration Therapy superbill', scoreServiceMatch('IV Hydration Therapy', ivRow) >= 100);
check('Premium exact row beats IV drip partial', (() => {
  const premiumRow = { name: 'Premium Drip Package', aliases: [] };
  const ivScore = scoreServiceMatch('Premium Drip Package', ivRow);
  const premiumScore = scoreServiceMatch('Premium Drip Package', premiumRow);
  return premiumScore > ivScore;
})());

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Sluice IV Hydration config tests passed');
