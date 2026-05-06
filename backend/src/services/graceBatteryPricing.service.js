/**
 * Battery missing / not installed (`battery === 'no'`) → small fixed % on offer dollars,
 * applied as its own multiplier (not bundled in condition stack).
 */

const { isNo } = require('./graceOperationalPricing.service');

const BATTERY_MISSING_DEDUCTION = 0.005;
const BATTERY_MISSING_FINAL_MULTIPLIER = 1 - BATTERY_MISSING_DEDUCTION;

/**
 * @param {object} assessment
 * @returns {number} 1 or 0.995 when battery is not present
 */
function batteryMissingFinalMultiplier(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  return isNo(a.battery) ? BATTERY_MISSING_FINAL_MULTIPLIER : 1;
}

module.exports = {
  BATTERY_MISSING_DEDUCTION,
  BATTERY_MISSING_FINAL_MULTIPLIER,
  batteryMissingFinalMultiplier,
};
