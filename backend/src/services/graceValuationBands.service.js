/**
 * Grace to Grace — Make / model / year-range valuation bands.
 *
 * Each row defines worst and best min/max dollars; seller assessment is mapped to
 * a score 0 = toward worst, 1 = toward best, and we interpolate the offer range
 * and a point (mid) within that range.
 */

const db = require('../db/connection');
const { getStartDrive, isNo } = require('./graceCamryRule.service');

const START = {
  starts_drives: 'starts_drives',
  starts_not_drives: 'starts_not_drives',
  does_not_start: 'does_not_start',
};

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * "Corolla" / "Corolla XSE" → first segment for index matching; keeps trim variants aligned.
 * @param {string} m
 * @returns {string}
 */
function modelBaseName(m) {
  const t = String(m || '')
    .trim()
    .split(/[/,]/)[0]
    .trim();
  if (!t) return '';
  const space = t.indexOf(' ');
  if (space === -1) return t;
  return t.slice(0, space);
}

function titleScore(titleStatus) {
  const t = String(titleStatus || 'clean')
    .trim()
    .toLowerCase();
  const map = {
    clean: 1,
    lien_reported: 0.7,
    rebuilt: 0.32,
    salvage: 0.1,
    parts_only: 0.05,
    missing_unknown: 0.4,
  };
  return map[t] ?? 0.45;
}

function startDriveScore(assessment) {
  const sd = getStartDrive(assessment);
  if (sd === START.does_not_start) return 0.06;
  if (sd === START.starts_not_drives) return 0.48;
  return 1;
}

function mean(nums) {
  const v = nums.filter((n) => Number.isFinite(n));
  if (v.length === 0) return 0.5;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/**
 * 0 = matches “worst tier” more, 1 = matches “best tier” more.
 * @param {object} assessment
 * @param {string} [titleStatus]
 * @param {string} [mileageMidpoint]
 */
function scoreConditionTier(assessment, titleStatus, mileageMidpoint) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const body = a.body && typeof a.body === 'object' ? a.body : {};

  const tTitle = titleScore(titleStatus);
  const tStart = startDriveScore(a);
  const tBatt = isNo(a.battery) ? 0.12 : 1;
  const tKey = isNo(a.key) ? 0.1 : 1;
  const tTireA = isNo(a.tiresAttached) ? 0.2 : 1;
  const tTireI = isNo(a.tiresInflated) ? 0.4 : 1;
  const tTire = tTireA * tTireI < 0.5 ? 0.35 : mean([tTireA, tTireI]);
  const tExt =
    a.exterior === 'rust_or_damage' ? 0.22 : 1;
  const tComp = a.exteriorComplete === 'incomplete' ? 0.28 : 1;
  const tCat = a.catalytic === 'missing' ? 0.1 : 1;

  const panelKeys = ['front', 'rear', 'left', 'right'];
  const panelParts = panelKeys.map((k) => (body[k] === 'some' ? 0.45 : 1));
  const tPanels = mean(panelParts);

  let tEngine = body.engine === 'some' ? 0.25 : 1;
  let tFlood = body.flood === 'some' ? 0.02 : 1;
  let tFire = body.fire === 'some' ? 0.04 : 1;
  const tGlass = body.glass === 'some' ? 0.55 : 1;
  const tAir = body.airbag === 'some' ? 0.4 : 1;

  const n = parseInt(String(mileageMidpoint || '').replace(/\D/g, ''), 10);
  let tMile = 1;
  if (Number.isFinite(n) && n > 0) {
    if (n >= 220000) tMile = 0.68;
    else if (n >= 200000) tMile = 0.78;
    else if (n >= 150000) tMile = 0.9;
    else if (n >= 120000) tMile = 0.95;
  }

  let s = mean([
    tTitle,
    tStart,
    tBatt,
    tKey,
    tTire,
    tExt,
    tComp,
    tCat,
    tPanels,
    tEngine,
    tFlood,
    tFire,
    tGlass,
    tAir,
    tMile,
  ]);

  if (tFlood < 0.1) s = Math.min(s, 0.18);
  if (tFire < 0.1) s = Math.min(s, 0.15);

  return Math.max(0, Math.min(1, s));
}

function orderPair(min, max) {
  return min <= max ? [min, max] : [max, min];
}

/**
 * @param {object} row
 * @param {number} s
 */
function interpolateBand(row, s) {
  const [wMin, wMax] = orderPair(row.worst_min, row.worst_max);
  const [bMin, bMax] = orderPair(row.best_min, row.best_max);
  const t = Math.max(0, Math.min(1, s));
  const low = Math.round(wMin + t * (bMin - wMin));
  const high = Math.round(wMax + t * (bMax - wMax));
  const wMid = (wMin + wMax) / 2;
  const bMid = (bMin + bMax) / 2;
  const point = Math.round(wMid + t * (bMid - wMid));
  const outLow = low <= high ? low : high;
  const outHigh = low <= high ? high : low;
  return { low: outLow, high: outHigh, pointOffer: point };
}

/**
 * @param {string} make
 * @param {string} model
 * @param {string|number} year
 * @returns {Promise<object|null>}
 */
async function findValuationBand(make, model, year) {
  const y = parseInt(String(year || ''), 10);
  if (Number.isNaN(y) || y < 1900) return null;
  const mk = norm(make);
  const mBase = norm(modelBaseName(model));
  const mFull = norm(model);

  const result = await db.query(
    `SELECT id, make, model, year_from, year_to, worst_min, worst_max, best_min, best_max
     FROM vehicle_valuation_bands
     WHERE lower(btrim(make)) = $1
       AND $4::int >= year_from
       AND $4::int <= year_to
       AND (
         lower(btrim(model)) = $2
         OR $3 = lower(btrim(model))
         OR $3 LIKE lower(btrim(model)) || ' %'
       )
     ORDER BY (year_to - year_from) ASC, id ASC
     LIMIT 1`,
    [mk, mBase, mFull, y],
  );
  return result.rows[0] || null;
}

/**
 * @param {object} validated - validateEstimateBody output
 * @returns {Promise<object|null>}
 */
async function tryComputeValuationBandEstimate(validated) {
  const row = await findValuationBand(
    validated.make,
    validated.model,
    validated.year,
  );
  if (!row) return null;

  const t = scoreConditionTier(validated.assessment, validated.titleStatus, validated.mileageMidpoint);
  const { low, high, pointOffer } = interpolateBand(row, t);

  return {
    low,
    high,
    pointOffer,
    meta: {
      modelVersion: 'valuation_bands_v1',
      estimator: 'valuation_bands',
      bandId: row.id,
      make: row.make,
      model: row.model,
      yearFrom: row.year_from,
      yearTo: row.year_to,
      worst: { min: row.worst_min, max: row.worst_max },
      best: { min: row.best_min, max: row.best_max },
      conditionTierScore: Number(t.toFixed(4)),
      titleStatus: String(validated.titleStatus || 'clean'),
      vehicleClass: 'band_table',
    },
  };
}

module.exports = {
  findValuationBand,
  tryComputeValuationBandEstimate,
  scoreConditionTier,
  interpolateBand,
  modelBaseName,
  norm,
};
