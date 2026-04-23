/**
 * Grace to Grace — Toyota Camry (2005–2017) rule engine v2.
 *
 * Deterministic pipeline:
 *   1) Gate (make/model/year)  → fall back to v1 if ineligible.
 *   2) Condition gate           → picks rule band (non_running | running | accident).
 *   3) DB lookup                → priceLow / priceHigh from vehicle_price_rules.
 *   4) Point estimate           → priceLow + 0.6 * (priceHigh - priceLow).
 *   5) Multipliers              → mileage + title, clamped to [0.35, 1.10].
 *   6) Flat deductions          → tires / glass / airbag / body panels.
 *   7) Clamp                    → never below priceLow, never above priceHigh.
 *   8) Persist pricing_requests and return meta for the UI.
 *
 * Guardrail: factors that choose the condition band (drives, engine, fire, flood,
 * multiple body panels) are NOT also applied as multipliers/deductions, so the
 * penalty is never counted twice.
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

const DEDUCTIONS = {
  tiresAttachedNo: 150,
  tiresInflatedNo: 75,
  glassSome: 100,
  airbagSome: 150,
  panelSomeEach: 75,
};

const MULTIPLIER_FLOOR = 0.35;
const MULTIPLIER_CEILING = 1.1;

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
 * Decide rule band. First match wins (severity ordered).
 * Returns: { condition, reason } — reason is meta-only.
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

function computeDeductions(assessment, conditionReason) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};
  const details = {};
  let total = 0;

  if (a.tiresAttached === 'no') {
    details.tiresAttachedNo = DEDUCTIONS.tiresAttachedNo;
    total += DEDUCTIONS.tiresAttachedNo;
  }
  if (a.tiresInflated === 'no') {
    details.tiresInflatedNo = DEDUCTIONS.tiresInflatedNo;
    total += DEDUCTIONS.tiresInflatedNo;
  }
  if (body.glass === 'some') {
    details.glassSome = DEDUCTIONS.glassSome;
    total += DEDUCTIONS.glassSome;
  }

  // If condition band is already "accident", big body penalties are baked in — skip to avoid double-dip.
  if (conditionReason !== 'multiple_body_panels' && conditionReason !== 'engine_damage' && conditionReason !== 'fire_damage' && conditionReason !== 'flood_damage') {
    if (body.airbag === 'some') {
      details.airbagSome = DEDUCTIONS.airbagSome;
      total += DEDUCTIONS.airbagSome;
    }
    const panels = PANEL_KEYS.filter((k) => body[k] === 'some');
    if (panels.length > 0) {
      details.panelsSome = panels.length * DEDUCTIONS.panelSomeEach;
      details.panelsSomeKeys = panels;
      total += panels.length * DEDUCTIONS.panelSomeEach;
    }
  }

  return { total, details };
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
    rule = await loadRule({ yearBand, condition });
  } catch (err) {
    console.error('[graceCamry] rule lookup failed:', err.message);
    return null;
  }
  if (!rule) return null;

  const priceLow = Number(rule.price_low);
  const priceHigh = Number(rule.price_high);
  const point = finalOfferFromBand(priceLow, priceHigh);

  const mileageMult = mileageMultiplier(validated.mileageMidpoint);
  const titleMult = titleMultiplier(validated.titleStatus);
  const rawMult = mileageMult * titleMult;
  const clampedMult = clamp(rawMult, MULTIPLIER_FLOOR, MULTIPLIER_CEILING);

  const { total: deductionsTotal, details: deductionsBreakdown } = computeDeductions(
    validated.assessment,
    reason,
  );

  const rawOffer = Math.round(point * clampedMult - deductionsTotal);
  const finalOffer = clamp(rawOffer, priceLow, priceHigh);

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
      modelVersion: 'camry_rule_table_v2',
      estimator: 'camry_rule_table',
      yearBand,
      ruleCondition: condition,
      ruleConditionReason: reason,
      priceLow,
      priceHigh,
      pointFromBand: point,
      pointOffer: finalOffer,
      conditionFactor: 0.6,
      multipliers: {
        mileage: Number(mileageMult.toFixed(3)),
        title: Number(titleMult.toFixed(3)),
        raw: Number(rawMult.toFixed(3)),
        applied: Number(clampedMult.toFixed(3)),
      },
      deductions: {
        total: deductionsTotal,
        ...deductionsBreakdown,
      },
      clamped: rawOffer !== finalOffer,
      vehicleClass: 'camry',
      baseBeforeCondition: point,
      scrapFloor: priceLow,
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
  computeDeductions,
  MILEAGE_MULTIPLIERS,
  TITLE_MULTIPLIERS,
  DEDUCTIONS,
};
