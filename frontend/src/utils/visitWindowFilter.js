export const VISITED_WITHIN_OPTIONS = [
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
  { value: 1095, label: '3 years' },
  { value: 1460, label: '4 years' },
];

export const NOT_VISITED_WITHIN_OPTIONS = [
  { value: 0, label: '0 days' },
  { value: 1, label: '1 day' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '3 months' },
  { value: 120, label: '120 days' },
  { value: 180, label: '6 months' },
];

const visitedLabel = (days) => VISITED_WITHIN_OPTIONS.find((o) => o.value === days)?.label || `${days} days`;
const notVisitedLabel = (days) => NOT_VISITED_WITHIN_OPTIONS.find((o) => o.value === days)?.label || `${days} days`;

export const DEFAULT_VISIT_WINDOW = {
  visitedWithinDays: 730,
  notVisitedWithinDays: 90,
  source: 'effective',
};

/** Sluice campaign preset — all visitors with a visit in the last 730 days. */
export const SLUICE_ALL_VISITORS_2YR = '730d';

export function getVisitFilterMode(filter, { sluiceCampaign = false } = {}) {
  if (filter?.visitWindow) return 'window';
  if (sluiceCampaign && filter?.lastVisit === SLUICE_ALL_VISITORS_2YR) return 'visited2yr';
  if (filter?.lastVisit) return 'simple';
  return 'none';
}

const isNotVisitedWithinDays = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
};

export function formatVisitWindowLabel(visitWindow) {
  if (!visitWindow?.visitedWithinDays || !isNotVisitedWithinDays(visitWindow.notVisitedWithinDays)) return null;
  const inner = notVisitedLabel(visitWindow.notVisitedWithinDays);
  const outer = visitedLabel(visitWindow.visitedWithinDays);
  const source = visitWindow.source === 'appointments' ? ' (appointments only)' : '';
  return `Visited within ${outer}, not in last ${inner}${source}`;
}

export function normalizeVisitWindowForForm(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VISIT_WINDOW };
  const visited = Number(raw.visitedWithinDays);
  const notVisited = Number(raw.notVisitedWithinDays);
  return {
    visitedWithinDays: Number.isFinite(visited) && visited >= 1
      ? visited
      : DEFAULT_VISIT_WINDOW.visitedWithinDays,
    notVisitedWithinDays: Number.isFinite(notVisited) && notVisited >= 0
      ? notVisited
      : DEFAULT_VISIT_WINDOW.notVisitedWithinDays,
    source: raw.source === 'appointments' ? 'appointments' : 'effective',
  };
}
