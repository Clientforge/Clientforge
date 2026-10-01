const VISIT_SOURCES = new Set(['effective', 'appointments']);

const normalizeDays = (value, { min = 1 } = {}) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > 3650) return null;
  return n;
};

/**
 * Visit window: last visit within outer window but not within inner window.
 * Example: visited within 730 days AND not visited within 90 days → lapsed 3–24 months.
 * @param {object|null|undefined} raw
 * @returns {{ visitedWithinDays: number, notVisitedWithinDays: number, source: string }|null}
 */
const normalizeVisitWindow = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const visitedWithinDays = normalizeDays(raw.visitedWithinDays, { min: 1 });
  const notVisitedWithinDays = normalizeDays(raw.notVisitedWithinDays, { min: 0 });
  if (visitedWithinDays == null || notVisitedWithinDays == null) return null;
  if (notVisitedWithinDays >= visitedWithinDays) return null;
  const source = VISIT_SOURCES.has(raw.source) ? raw.source : 'effective';
  return { visitedWithinDays, notVisitedWithinDays, source };
};

/**
 * @param {string[]} conditions
 * @param {object|null|undefined} visitWindow
 * @param {string} [column='effective_last_at']
 */
const appendVisitWindowConditions = (conditions, visitWindow, column = 'effective_last_at') => {
  const window = normalizeVisitWindow(visitWindow);
  if (!window) return;
  conditions.push(`${column} IS NOT NULL`);
  conditions.push(`${column} >= NOW() - INTERVAL '${window.visitedWithinDays} days'`);
  conditions.push(`${column} < NOW() - INTERVAL '${window.notVisitedWithinDays} days'`);
};

module.exports = {
  VISIT_SOURCES,
  normalizeVisitWindow,
  appendVisitWindowConditions,
};
