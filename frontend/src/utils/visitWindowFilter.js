export const VISITED_WITHIN_OPTIONS = [
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
  { value: 1095, label: '3 years' },
  { value: 1460, label: '4 years' },
];

export const NOT_VISITED_WITHIN_OPTIONS = [
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

export function getVisitFilterMode(filter) {
  if (filter?.visitWindow) return 'window';
  if (filter?.lastVisit) return 'simple';
  return 'none';
}

export function formatVisitWindowLabel(visitWindow) {
  if (!visitWindow?.visitedWithinDays || !visitWindow?.notVisitedWithinDays) return null;
  const inner = notVisitedLabel(visitWindow.notVisitedWithinDays);
  const outer = visitedLabel(visitWindow.visitedWithinDays);
  const source = visitWindow.source === 'appointments' ? ' (appointments only)' : '';
  return `Visited within ${outer}, not in last ${inner}${source}`;
}

export function normalizeVisitWindowForForm(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VISIT_WINDOW };
  return {
    visitedWithinDays: raw.visitedWithinDays || DEFAULT_VISIT_WINDOW.visitedWithinDays,
    notVisitedWithinDays: raw.notVisitedWithinDays || DEFAULT_VISIT_WINDOW.notVisitedWithinDays,
    source: raw.source === 'appointments' ? 'appointments' : 'effective',
  };
}
