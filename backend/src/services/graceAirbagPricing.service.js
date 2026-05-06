/**
 * Deployed airbag (`body.airbag === 'some'`) → fixed % deduction on **final** dollars.
 */

const AIRBAG_DEPLOYED_DEDUCTION = 0.138;
const AIRBAG_DEPLOYED_FINAL_MULTIPLIER = 1 - AIRBAG_DEPLOYED_DEDUCTION;

/**
 * @param {object} assessment
 * @returns {number} 1 or ~0.862 when airbags deployed
 */
function airbagDeployedFinalMultiplier(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};
  if (body.airbag === 'some') return AIRBAG_DEPLOYED_FINAL_MULTIPLIER;
  return 1;
}

module.exports = {
  AIRBAG_DEPLOYED_DEDUCTION,
  AIRBAG_DEPLOYED_FINAL_MULTIPLIER,
  airbagDeployedFinalMultiplier,
};
