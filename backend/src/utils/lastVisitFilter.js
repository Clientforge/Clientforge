/** Allowed last-visit audience / contact filter presets. */
const LAST_VISIT_PRESETS = new Set([
  '30d', '60d', '90d', '120d', '180d', '365d',
  'not30d', 'not60d', 'not90d', 'not120d', 'not180d', 'not365d',
  'not730d', 'not1095d', 'not1460d',
  'none',
  // legacy Contacts filter
  'older90d',
]);

const normalizeLastVisitPreset = (value) => {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  return LAST_VISIT_PRESETS.has(v) ? v : null;
};

/**
 * Append SQL condition for last-visit filter.
 * @param {string[]} conditions
 * @param {string|null|undefined} lastVisit
 * @param {string} [column='last_visit_at'] — use effective_last_at for campaign CTE audiences
 */
const appendLastVisitCondition = (conditions, lastVisit, column = 'last_visit_at') => {
  const preset = normalizeLastVisitPreset(lastVisit);
  if (!preset) return;

  if (preset === 'none') {
    conditions.push(`${column} IS NULL`);
    return;
  }

  if (preset.startsWith('not') || preset === 'older90d') {
    const days = preset === 'older90d' ? '90' : preset.slice(3, -1);
    conditions.push(`(${column} IS NULL OR ${column} < NOW() - INTERVAL '${days} days')`);
    return;
  }

  const days = preset.slice(0, -1);
  conditions.push(`${column} >= NOW() - INTERVAL '${days} days'`);
};

module.exports = {
  LAST_VISIT_PRESETS,
  normalizeLastVisitPreset,
  appendLastVisitCondition,
};
