/**
 * Grace to Grace — static Toyota Camry (2005–2017) rule table + point estimate.
 * Only used from computeGraceEstimate when the vehicle matches and DB rules exist.
 */

const db = require('../db/connection');

const BANDS = [
  { band: '2005-2008', min: 2005, max: 2008 },
  { band: '2009-2012', min: 2009, max: 2012 },
  { band: '2013-2015', min: 2013, max: 2015 },
  { band: '2016-2017', min: 2016, max: 2017 },
];

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
  if (String(make || '')
    .trim()
    .toLowerCase() !== 'toyota') {
    return false;
  }
  return isCamryModel(model);
}

/**
 * Map detailed assessment to rule condition: non_running | running | accident
 */
function mapAssessmentToCondition(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const drives = a.drives === 'no' ? 'no' : 'yes';
  if (drives === 'no') return 'non_running';
  const body = a.body && typeof a.body === 'object' ? a.body : {};
  if (['engine', 'flood', 'fire'].some((k) => body[k] === 'some')) return 'accident';
  const panelKeys = ['front', 'rear', 'left', 'right', 'glass', 'airbag'];
  const damageCount = panelKeys.filter((k) => body[k] === 'some').length;
  if (damageCount >= 2) return 'accident';
  return 'running';
}

function finalOfferFromBand(priceLow, priceHigh) {
  return Math.round(priceLow + 0.6 * (priceHigh - priceLow));
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
    [
      vin || null,
      make,
      model,
      year,
      condition,
      finalOffer,
      priceLow,
      priceHigh,
    ],
  );
}

/**
 * @returns {Promise<object|null>} Estimate payload or null to fall back to v1.
 */
async function tryComputeCamryRuleEstimate(validated) {
  if (!isCamryCandidate(validated.make, validated.model)) return null;
  const yearBand = getYearBand(validated.year);
  if (!yearBand) return null;

  const condition = mapAssessmentToCondition(validated.assessment);
  let rule;
  try {
    rule = await loadRule({ yearBand, condition });
  } catch (err) {
    console.error('[graceCamry] rule lookup failed:', err.message);
    return null;
  }
  if (!rule) return null;

  const { price_low: priceLow, price_high: priceHigh } = rule;
  const finalOffer = finalOfferFromBand(priceLow, priceHigh);
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
      modelVersion: 'camry_rule_table_v1',
      estimator: 'camry_rule_table',
      yearBand,
      ruleCondition: condition,
      priceLow,
      priceHigh,
      pointOffer: finalOffer,
      vehicleClass: 'camry',
      conditionFactor: 0.6,
      baseBeforeCondition: finalOffer,
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
};
