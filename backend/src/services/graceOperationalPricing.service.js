/**
 * Key / start-drive adjustments applied as explicit multipliers after “condition” pricing,
 * so they are not double-counted in band pillars or Camry drivability × key stack.
 */

const START_DRIVE = {
  starts_drives: 'starts_drives',
  starts_not_drives: 'starts_not_drives',
  does_not_start: 'does_not_start',
};

/** No key → non-operational bucket (~20% vs operational baseline). */
const NO_KEY_PRICE_FACTOR = 0.8;

/** “Does not start (or requires a jump)” when key is available — small nudge (~2%). */
const DOES_NOT_START_WITH_KEY_FACTOR = 0.98;

/** Starts but does not drive (key available). */
const STARTS_NOT_DRIVES_FACTOR = 0.9;

function isNo(val) {
  return String(val || '').trim().toLowerCase() === 'no';
}

/**
 * @returns {'starts_drives'|'starts_not_drives'|'does_not_start'}
 */
function getStartDrive(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const sd = String(a.startDrive || '').trim();
  if (sd === START_DRIVE.starts_drives || sd === START_DRIVE.starts_not_drives || sd === START_DRIVE.does_not_start) {
    return sd;
  }
  if (isNo(a.drives)) return START_DRIVE.does_not_start;
  return START_DRIVE.starts_drives;
}

/**
 * @param {object} assessment
 * @returns {{ factor: number, reason: string }}
 */
function operationalPricingDetail(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  if (isNo(a.key)) {
    return { factor: NO_KEY_PRICE_FACTOR, reason: 'no_key' };
  }
  const sd = getStartDrive(a);
  if (sd === START_DRIVE.does_not_start) {
    return { factor: DOES_NOT_START_WITH_KEY_FACTOR, reason: 'does_not_start_with_key' };
  }
  if (sd === START_DRIVE.starts_not_drives) {
    return { factor: STARTS_NOT_DRIVES_FACTOR, reason: 'starts_not_drives' };
  }
  return { factor: 1, reason: 'operational' };
}

function operationalPriceMultiplier(assessment) {
  return operationalPricingDetail(assessment).factor;
}

module.exports = {
  START_DRIVE,
  isNo,
  getStartDrive,
  operationalPriceMultiplier,
  operationalPricingDetail,
  NO_KEY_PRICE_FACTOR,
  DOES_NOT_START_WITH_KEY_FACTOR,
  STARTS_NOT_DRIVES_FACTOR,
};