#!/usr/bin/env node
const { normalizeServiceName } = require('../src/services/tenant-service.service');

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

const fillers = { name: 'Fillers', aliases: ['Lip Fillers', 'Dermal Fillers'] };
const tests = [
  ['Fillers', fillers, true],
  ['Lip Fillers - 1ml', fillers, true],
  ['Botox', { name: 'Tox Treatments', aliases: ['Botox'] }, true],
  ['Random Service', fillers, false],
];

let failed = 0;
for (const [raw, row, shouldMatch] of tests) {
  const score = scoreServiceMatch(raw, row);
  const matched = score >= 50;
  const ok = matched === shouldMatch;
  console.log(`${ok ? '✓' : '✗'} "${raw}" → ${matched} (score ${score})`);
  if (!ok) failed += 1;
}

process.exit(failed > 0 ? 1 : 0);
