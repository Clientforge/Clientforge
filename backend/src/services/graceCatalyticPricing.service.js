/**
 * Missing catal converter → fixed % deduction on **final** dollars (after mileage, operational, etc.).
 * Present / other values → no change.
 */

const CATALYTIC_MISSING_DEDUCTION = 0.0374;
const CATALYTIC_FINAL_MULTIPLIER = 1 - CATALYTIC_MISSING_DEDUCTION;

/**
 * @param {object} assessment
 * @returns {number} 1 or ~0.9626 when `catalytic === 'missing'`
 */
function catalyticFinalMultiplier(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  if (a.catalytic === 'missing') return CATALYTIC_FINAL_MULTIPLIER;
  return 1;
}

module.exports = {
  CATALYTIC_MISSING_DEDUCTION,
  CATALYTIC_FINAL_MULTIPLIER,
  catalyticFinalMultiplier,
};
