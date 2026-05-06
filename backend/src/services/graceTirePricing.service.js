/**
 * Tire condition → fixed multiplier on offer dollars (aligned with observed G2G behavior).
 *
 * Single question model: `assessment.tireCondition` = `all_ok` | `flat` | `missing`.
 * Legacy: `tiresInflated` / `tiresAttached` (`no` = problem) still supported.
 */

const { isNo } = require('./graceOperationalPricing.service');

/** Observed: base 1815 → 1685 (~7.16% off). */
const TIRE_FLAT_FINAL_MULTIPLIER = 1685 / 1815;

/** Observed: base 1815 → 1540 (~15.15% off). */
const TIRE_MISSING_FINAL_MULTIPLIER = 1540 / 1815;

/**
 * @param {unknown} raw
 * @returns {'all_ok' | 'flat' | 'missing' | null}
 */
function normalizeTireCondition(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (s === 'all_ok' || s === 'flat' || s === 'missing') return s;
  return null;
}

/**
 * @param {object} assessment
 * @returns {'all_ok' | 'flat' | 'missing' | 'both_legacy'}
 */
function resolveTireCondition(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const explicit = normalizeTireCondition(a.tireCondition);
  if (explicit) return explicit;

  const notAttached = isNo(a.tiresAttached);
  const notInflated = isNo(a.tiresInflated);
  if (notAttached && notInflated) return 'both_legacy';
  if (notAttached) return 'missing';
  if (notInflated) return 'flat';
  return 'all_ok';
}

/**
 * @param {object} assessment
 * @returns {{ factor: number, mode: 'ok' | 'flat' | 'missing' | 'both_legacy' }}
 */
function tirePricingDetail(assessment) {
  const mode = resolveTireCondition(assessment);
  if (mode === 'flat') {
    return { factor: TIRE_FLAT_FINAL_MULTIPLIER, mode: 'flat' };
  }
  if (mode === 'missing') {
    return { factor: TIRE_MISSING_FINAL_MULTIPLIER, mode: 'missing' };
  }
  if (mode === 'both_legacy') {
    return {
      factor: TIRE_FLAT_FINAL_MULTIPLIER * TIRE_MISSING_FINAL_MULTIPLIER,
      mode: 'both_legacy',
    };
  }
  return { factor: 1, mode: 'ok' };
}

function tireConditionFinalMultiplier(assessment) {
  return tirePricingDetail(assessment).factor;
}

module.exports = {
  TIRE_FLAT_FINAL_MULTIPLIER,
  TIRE_MISSING_FINAL_MULTIPLIER,
  tirePricingDetail,
  tireConditionFinalMultiplier,
  resolveTireCondition,
  normalizeTireCondition,
};
