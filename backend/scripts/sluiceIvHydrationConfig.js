/**
 * Sluice Drip Spa — IV Hydration follow-up grouping.
 * Aliases are exact OptiMantra / patient-export service names (18 drips + superbill code).
 */

/** @type {string[]} */
const SLUICE_IV_DRIP_SERVICE_NAMES = [
  'Age-Defying Drip',
  'Beauty  Drip',
  'Detox Drip',
  'GI- Relief Drip',
  'Hair Revival Drip',
  'Hangover Relief Drip',
  'Immune Defense Drip',
  'Just Hydrate Drip',
  'Luna Drip',
  'Mama Vitality Drip',
  'Migraine Be Gone Drip',
  "Myers' Cocktail Drip",
  'Pain Relief Drip',
  'Peak Performance Drip',
  'Post- Procedure Drip',
  'Serenity Drip',
  'Slim & Trim Drip',
  'Tailor - Made Sluice Drip',
];

/** OptiMantra superbill `code` when a generic IV line is used. */
const SLUICE_IV_CHECKOUT_ALIASES = [
  'IV Hydration Therapy',
];

const SLUICE_IV_HYDRATION_SERVICE_NAME = 'IV Hydration';
const SLUICE_PREMIUM_DRIP_PACKAGE_NAME = 'Premium Drip Package';

const SLUICE_IV_HYDRATION_FOLLOW_UPS = [
  {
    enabled: true,
    intervalDays: 4,
    message:
      "Hi {firstName}, we hope you're feeling refreshed and revitalized after your recent {serviceName} at {businessName}. ✨ We wanted to check in and see how you're doing. Consistent wellness treatments can help you maintain your energy, hydration, and overall well-being. {bookingLink}",
  },
  {
    enabled: true,
    intervalDays: 10,
    message:
      "Hi {firstName}, just checking in! We hope you're still enjoying the benefits of your recent {serviceName} at {businessName}. 💧 If it's been a little while, this is a great time to schedule your next session and keep that refreshed, energized feeling going. {bookingLink}",
  },
  {
    enabled: true,
    intervalDays: 20,
    message:
      "Hi {firstName}, it's been a few weeks since your {serviceName} at {businessName}. We'd love to see you again — book your next IV when you're ready: {bookingLink}",
  },
];

function normalizeServiceName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSluiceIvDripServiceName(name) {
  const norm = normalizeServiceName(name);
  return SLUICE_IV_DRIP_SERVICE_NAMES.some((d) => normalizeServiceName(d) === norm);
}

function buildIvHydrationService() {
  return {
    name: SLUICE_IV_HYDRATION_SERVICE_NAME,
    aliases: [...SLUICE_IV_CHECKOUT_ALIASES, ...SLUICE_IV_DRIP_SERVICE_NAMES],
    returnIntervalDays: null,
    rebookingEnabled: true,
    rebookMessage: '',
    rebookEmailSubject: '',
    followUpCampaigns: SLUICE_IV_HYDRATION_FOLLOW_UPS.map((step, index) => ({
      id: `iv-hydration-${step.intervalDays}d`,
      ...step,
      sortOrder: index,
    })),
    notes: 'Every 3–4 months — grouped drip treatments (4/10/20 day follow-ups)',
    sortOrder: 0,
  };
}

function buildPremiumDripPackageService() {
  return {
    name: SLUICE_PREMIUM_DRIP_PACKAGE_NAME,
    aliases: [],
    returnIntervalDays: null,
    rebookingEnabled: false,
    rebookMessage: '',
    rebookEmailSubject: '',
    followUpCampaigns: [],
    notes: 'Excluded from IV Hydration follow-up sequence',
    sortOrder: 9999,
  };
}

/**
 * Merge IV Hydration + Premium Drip Package into an existing service list.
 * Disables auto-rebook on standalone rows that duplicate the 18 drip names.
 */
function mergeSluiceIvHydrationServices(existingServices) {
  const kept = (existingServices || [])
    .filter((s) => {
      const norm = normalizeServiceName(s.name);
      if (norm === normalizeServiceName(SLUICE_IV_HYDRATION_SERVICE_NAME)) return false;
      if (norm === normalizeServiceName(SLUICE_PREMIUM_DRIP_PACKAGE_NAME)) return false;
      return true;
    })
    .map((s) => {
      if (!isSluiceIvDripServiceName(s.name)) return s;
      return {
        ...s,
        rebookingEnabled: false,
        returnIntervalDays: null,
        followUpCampaigns: [],
        notes: s.notes || 'Follow-ups via IV Hydration service',
      };
    });

  return [
    buildIvHydrationService(),
    ...kept,
    buildPremiumDripPackageService(),
  ];
}

module.exports = {
  SLUICE_IV_DRIP_SERVICE_NAMES,
  SLUICE_IV_CHECKOUT_ALIASES,
  SLUICE_IV_HYDRATION_SERVICE_NAME,
  SLUICE_PREMIUM_DRIP_PACKAGE_NAME,
  SLUICE_IV_HYDRATION_FOLLOW_UPS,
  normalizeServiceName,
  isSluiceIvDripServiceName,
  buildIvHydrationService,
  buildPremiumDripPackageService,
  mergeSluiceIvHydrationServices,
};
