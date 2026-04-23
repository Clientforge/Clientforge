/**
 * Grace to Grace — Toyota Camry (2005–2017) rule engine v3.
 *
 * Base price always comes from the **running** row (year band + running),
 * so severe conditions (flood, accident band, etc.) never re-price upward
 * by switching to a different table row.
 *
 * Deterministic pipeline:
 *   1) Gate (make/model/year)  → fall back to v1 if ineligible.
 *   2) DB lookup (running)      → priceLow / priceHigh, scrap floor = priceLow.
 *   3) Base point               → priceLow + 0.6 * (priceHigh - priceLow).
 *   4) Multipliers (mileage × title) → clamped to [0.35, 1.10].
 *   5) Drivability / tires     → all multiplicative; no additive deductions.
 *   6) Body/damage penalties   → per-field multipliers when body[field] === 'some'.
 *   7) Clean boost             → 1.05 only when no body damage is reported.
 *   8) Clamp                   → [scrapFloor, priceHigh] from the running row.
 *   9) Persist pricing_requests and return meta for the UI.
 *
 * `mapAssessmentToCondition` is kept for labels / logging only (assessment
 * category), not for which DB row is used in pricing.
 */

const db = require('../db/connection');

const BANDS = [
  { band: '2005-2008', min: 2005, max: 2008 },
  { band: '2009-2012', min: 2009, max: 2012 },
  { band: '2013-2015', min: 2013, max: 2015 },
  { band: '2016-2017', min: 2016, max: 2017 },
];

const MILEAGE_MULTIPLIERS = [
  { maxMid: 50000, factor: 1.06 },
  { maxMid: 100000, factor: 1.0 },
  { maxMid: 150000, factor: 0.94 },
  { maxMid: 200000, factor: 0.88 },
  { maxMid: Infinity, factor: 0.82 },
];

const TITLE_MULTIPLIERS = {
  clean: 1.0,
  lien_reported: 0.92,
  rebuilt: 0.9,
  missing_unknown: 0.8,
  salvage: 0.75,
  parts_only: 0.55,
};

const MULTIPLIER_FLOOR = 0.35;
const MULTIPLIER_CEILING = 1.1;

const BASE_RULE_CONDITION = 'running';

/** When assessment body[field] === 'some', multiply by this (always < 1 for damage). */
const DAMAGE_PENALTIES = {
  front: 0.95,
  rear: 0.97,
  left_side: 0.97,
  right_side: 0.97,
  engine: 0.7,
  flood: 0.5,
  fire: 0.4,
  glass: 0.95,
  airbag: 0.85,
};

const ASSESSMENT_TO_PENALTY = {
  front: 'front',
  rear: 'rear',
  left: 'left_side',
  right: 'right_side',
  engine: 'engine',
  flood: 'flood',
  fire: 'fire',
  glass: 'glass',
  airbag: 'airbag',
};

const PANEL_KEYS = ['front', 'rear', 'left', 'right'];

function getYearBand(yearStr) {
  const y = parseInt(String(yearStr || ''), 10);
  if (Number.isNaN(y)) return null;
  const row = BANDS.find((b) => y >= b.min && y <= b.max);
  return row ? row.band : null;
}

function isCamryModel(model) {
  const m = String(model || '')
    .trim()
    .toLowerCase();
  if (m === 'camry') return true;
  if (m.startsWith('camry ')) return true;
  if (m.startsWith('camry/')) return true;
  return false;
}

function isCamryCandidate(make, model) {
  if (
    String(make || '')
      .trim()
      .toLowerCase() !== 'toyota'
  ) {
    return false;
  }
  return isCamryModel(model);
}

/**
 * Decide assessment category. Used for display / DB logging only — not the pricing row.
 * Returns: { condition, reason }.
 */
function mapAssessmentToCondition(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};

  if (body.fire === 'some') return { condition: 'accident', reason: 'fire_damage' };
  if (body.flood === 'some') return { condition: 'accident', reason: 'flood_damage' };
  if (a.drives === 'no') return { condition: 'non_running', reason: 'does_not_drive' };
  if (body.engine === 'some') return { condition: 'accident', reason: 'engine_damage' };

  const panelSevereCount = [...PANEL_KEYS, 'airbag'].filter((k) => body[k] === 'some').length;
  if (panelSevereCount >= 2) return { condition: 'accident', reason: 'multiple_body_panels' };

  return { condition: 'running', reason: 'baseline' };
}

function finalOfferFromBand(priceLow, priceHigh) {
  return Math.round(priceLow + 0.6 * (priceHigh - priceLow));
}

function mileageMultiplier(mileageMidpoint) {
  const n = parseInt(String(mileageMidpoint || ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const row = MILEAGE_MULTIPLIERS.find((r) => n <= r.maxMid);
  return row ? row.factor : 1;
}

function titleMultiplier(titleStatus) {
  const k = String(titleStatus || 'clean').toLowerCase();
  return TITLE_MULTIPLIERS[k] ?? TITLE_MULTIPLIERS.clean;
}

/**
 * @returns {{ factor: number, applied: Record<string, number> }} Product of all damage multipliers; applied maps penalty key → factor.
 */
function computeDamageMultiplierProduct(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};
  let factor = 1;
  const applied = {};

  for (const [bodyKey, penaltyKey] of Object.entries(ASSESSMENT_TO_PENALTY)) {
    if (body[bodyKey] === 'some') {
      const p = DAMAGE_PENALTIES[penaltyKey];
      if (p != null && p < 1) {
        applied[penaltyKey] = p;
        factor *= p;
      }
    }
  }

  return { factor, applied };
}

function hasNoBodyDamage(assessment) {
  return computeDamageMultiplierProduct(assessment).factor === 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function loadRule({ yearBand, condition }) {
  const result = await db.query(
    `SELECT price_low, price_high
     FROM vehicle_price_rules
     WHERE make = 'Toyota' AND model = 'Camry' AND year_band = $1 AND condition = $2
     LIMIT 1`,
    [yearBand, condition],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function logPricingRequest({
  vin,
  make,
  model,
  year,
  condition,
  finalOffer,
  priceLow,
  priceHigh,
}) {
  await db.query(
    `INSERT INTO pricing_requests (vin, make, model, year, condition, final_offer, price_low, price_high)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [vin || null, make, model, year, condition, finalOffer, priceLow, priceHigh],
  );
}

/**
 * @returns {Promise<object|null>} Estimate payload or null to fall back to v1.
 */
async function tryComputeCamryRuleEstimate(validated) {
  if (!isCamryCandidate(validated.make, validated.model)) return null;
  const yearBand = getYearBand(validated.year);
  if (!yearBand) return null;

  const { condition, reason } = mapAssessmentToCondition(validated.assessment);

  let rule;
  try {
    rule = await loadRule({ yearBand, condition: BASE_RULE_CONDITION });
  } catch (err) {
    console.error('[graceCamry] rule lookup failed:', err.message);
    return null;
  }
  if (!rule) return null;

  const priceLow = Number(rule.price_low);
  const priceHigh = Number(rule.price_high);
  const scrapFloor = priceLow;

  const basePrice = finalOfferFromBand(priceLow, priceHigh);

  const mileageMult = mileageMultiplier(validated.mileageMidpoint);
  const titleMult = titleMultiplier(validated.titleStatus);
  const rawMileageTitle = mileageMult * titleMult;
  const appliedMileageTitle = clamp(rawMileageTitle, MULTIPLIER_FLOOR, MULTIPLIER_CEILING);

  let price = basePrice * appliedMileageTitle;

  const a = validated.assessment && typeof validated.assessment === 'object' ? validated.assessment : {};
  const drivabilityMult = a.drives === 'no' ? 0.6 : 1;
  if (drivabilityMult < 1) {
    price *= drivabilityMult;
  }

  const tireIssue = a.tiresAttached === 'no' || a.tiresInflated === 'no';
  const tiresMult = tireIssue ? 0.9 : 1;
  if (tiresMult < 1) {
    price *= tiresMult;
  }

  const { factor: damageFactor, applied: damageApplied } = computeDamageMultiplierProduct(
    validated.assessment,
  );
  if (damageFactor < 1) {
    price *= damageFactor;
  }

  const cleanBoostEligible = hasNoBodyDamage(validated.assessment);
  const cleanBoostMult = cleanBoostEligible ? 1.05 : 1;
  if (cleanBoostMult > 1) {
    price *= cleanBoostMult;
  }

  const rawOffer = Math.round(price);
  const finalOffer = clamp(rawOffer, scrapFloor, priceHigh);

  const yearNum = parseInt(String(validated.year), 10) || 0;
  const vin = validated.vin && validated.vin.length === 17 ? validated.vin : null;

  try {
    await logPricingRequest({
      vin,
      make: 'Toyota',
      model: 'Camry',
      year: yearNum,
      condition,
      finalOffer,
      priceLow,
      priceHigh,
    });
  } catch (err) {
    console.error('[graceCamry] pricing_requests insert failed:', err.message);
  }

  return {
    low: priceLow,
    high: priceHigh,
    pointOffer: finalOffer,
    meta: {
      modelVersion: 'camry_rule_table_v3',
      estimator: 'camry_rule_table',
      yearBand,
      ruleCondition: condition,
      ruleConditionReason: reason,
      baseRule: BASE_RULE_CONDITION,
      priceLow,
      priceHigh,
      pointFromBand: basePrice,
      pointOffer: finalOffer,
      conditionFactor: 0.6,
      multipliers: {
        mileage: Number(mileageMult.toFixed(3)),
        title: Number(titleMult.toFixed(3)),
        rawMileageTitle: Number(rawMileageTitle.toFixed(3)),
        appliedMileageTitle: Number(appliedMileageTitle.toFixed(3)),
        drivability: drivabilityMult,
        tires: tiresMult,
        damage: Number(damageFactor.toFixed(4)),
        cleanBoost: cleanBoostMult,
        combinedPreClamp: Number(
          (
            appliedMileageTitle
            * drivabilityMult
            * tiresMult
            * damageFactor
            * cleanBoostMult
          ).toFixed(4),
        ),
      },
      damagePenalties: damageApplied,
      cleanBoostApplied: cleanBoostMult > 1,
      clamped: rawOffer !== finalOffer,
      vehicleClass: 'camry',
      baseBeforeCondition: basePrice,
      scrapFloor,
      titleStatus: String(validated.titleStatus || 'clean'),
    },
  };
}

module.exports = {
  tryComputeCamryRuleEstimate,
  getYearBand,
  mapAssessmentToCondition,
  isCamryCandidate,
  finalOfferFromBand,
  mileageMultiplier,
  titleMultiplier,
  computeDamageMultiplierProduct,
  hasNoBodyDamage,
  MILEAGE_MULTIPLIERS,
  TITLE_MULTIPLIERS,
  DAMAGE_PENALTIES,
  BASE_RULE_CONDITION,
};
