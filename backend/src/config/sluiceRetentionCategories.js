const {
  SLUICE_IV_DRIP_SERVICE_NAMES,
  SLUICE_IV_CHECKOUT_ALIASES,
  normalizeServiceName,
} = require('../../scripts/sluiceIvHydrationConfig');

function slugifyTag(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const IV_HYDRATION_TAG_SLUGS = [
  ...new Set([
    ...SLUICE_IV_DRIP_SERVICE_NAMES.map(slugifyTag),
    ...SLUICE_IV_CHECKOUT_ALIASES.map(slugifyTag),
    'iv-hydration',
  ]),
].filter(Boolean);

/** Retention time buckets — maps to campaign lastVisit presets. */
const RETENTION_BUCKETS = [
  { key: 'not30d', label: '30+ days inactive', days: 30, campaignLastVisit: 'not30d' },
  { key: 'not90d', label: '90+ days inactive', days: 90, campaignLastVisit: 'not90d' },
  { key: 'not180d', label: '180+ days inactive', days: 180, campaignLastVisit: 'not180d' },
  { key: 'not365d', label: '1 year+ inactive', days: 365, campaignLastVisit: 'not365d' },
];

const SLUICE_SERVICE_CATEGORIES = [
  {
    key: 'all',
    label: 'All services',
    tagSlugs: [],
    appointmentPatterns: [],
  },
  {
    key: 'iv-hydration',
    label: 'IV Hydration',
    tagSlugs: IV_HYDRATION_TAG_SLUGS,
    appointmentPatterns: ['drip', 'iv hydration'],
  },
  {
    key: 'emsculpt',
    label: 'Emsculpt',
    tagSlugs: ['emsculpt-neo-consultation-visit', 'emsculpt-follow-up-visit'],
    appointmentPatterns: ['emsculpt'],
  },
  {
    key: 'emsella',
    label: 'Emsella',
    tagSlugs: ['emsella-session'],
    appointmentPatterns: ['emsella'],
  },
];

function getCategory(key) {
  return SLUICE_SERVICE_CATEGORIES.find((c) => c.key === key) || SLUICE_SERVICE_CATEGORIES[0];
}

function getBucket(key) {
  return RETENTION_BUCKETS.find((b) => b.key === key) || RETENTION_BUCKETS[1];
}

function appointmentMatchesCategory(serviceName, categoryKey) {
  const cat = getCategory(categoryKey);
  if (cat.key === 'all') return true;
  const norm = normalizeServiceName(serviceName);
  if (!norm) return false;
  if (cat.key === 'iv-hydration' && norm.includes('premium drip')) return false;
  return cat.appointmentPatterns.some((p) => norm.includes(normalizeServiceName(p)));
}

module.exports = {
  RETENTION_BUCKETS,
  SLUICE_SERVICE_CATEGORIES,
  IV_HYDRATION_TAG_SLUGS,
  getCategory,
  getBucket,
  appointmentMatchesCategory,
  slugifyTag,
};
