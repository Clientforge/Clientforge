/**
 * Exterior panel damage: any of `body.front|rear|left|right === 'some'`.
 * Single flat adjustment — average of observed ~11% (1-side) and ~13% (4-side) → 12% off final dollars
 * before catalytic / airbag (Camry) or included in the post-band chain (valuation bands).
 */

const PANEL_BODY_KEYS = ['front', 'rear', 'left', 'right'];

const EXTERIOR_PANEL_DAMAGE_DEDUCTION = 0.12;
const EXTERIOR_PANEL_DAMAGE_FINAL_MULTIPLIER = 1 - EXTERIOR_PANEL_DAMAGE_DEDUCTION;

function hasExteriorPanelDamage(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};
  return PANEL_BODY_KEYS.some((k) => body[k] === 'some');
}

/**
 * @param {object} assessment
 * @returns {number} 1 or 0.88 when any exterior panel is damaged
 */
function exteriorPanelDamageMultiplier(assessment) {
  return hasExteriorPanelDamage(assessment) ? EXTERIOR_PANEL_DAMAGE_FINAL_MULTIPLIER : 1;
}

module.exports = {
  PANEL_BODY_KEYS,
  EXTERIOR_PANEL_DAMAGE_DEDUCTION,
  EXTERIOR_PANEL_DAMAGE_FINAL_MULTIPLIER,
  hasExteriorPanelDamage,
  exteriorPanelDamageMultiplier,
};
