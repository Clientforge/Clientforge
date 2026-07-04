export const LAST_VISIT_OPTIONS = [
  { value: '', label: 'Any last visit' },
  { value: '30d', label: 'Visited last 30 days' },
  { value: '60d', label: 'Visited last 60 days' },
  { value: '90d', label: 'Visited last 90 days' },
  { value: '120d', label: 'Visited last 120 days' },
  { value: '180d', label: 'Visited last 180 days' },
  { value: '365d', label: 'Visited last year' },
  { value: 'not30d', label: 'Not visited in 30 days' },
  { value: 'not60d', label: 'Not visited in 60 days' },
  { value: 'not90d', label: 'Not visited in 90 days' },
  { value: 'not120d', label: 'Not visited in 120 days' },
  { value: 'not180d', label: 'Not visited in 180 days' },
  { value: 'not365d', label: 'Not visited in a year' },
  { value: 'none', label: 'No visit on file' },
];

const LABEL_BY_VALUE = Object.fromEntries(
  LAST_VISIT_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

/** @deprecated legacy Contacts preset */
LABEL_BY_VALUE.older90d = 'Not visited in 90+ days';

export function formatLastVisitLabel(lastVisit) {
  if (!lastVisit) return null;
  return LABEL_BY_VALUE[lastVisit] || null;
}
