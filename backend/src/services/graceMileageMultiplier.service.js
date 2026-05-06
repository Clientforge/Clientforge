/**
 * Grace / G2G — exact odometer → price multiplier.
 *
 * - Below 100,000 mi: ×1 (no mileage deduction).
 * - 100,000+ mi: piecewise curve from observed band deltas; linear interpolation within each span.
 *
 * `mileageMidpoint` in the API is the seller’s odometer reading (digits-only string or number).
 */

/** Each row: cumulative % decrease applied when crossing from the *previous* knot to `endMiles`. */
const MILEAGE_SEGMENT_DECREASES = [
  { endMiles: 110000, decrease: 0.0309 },
  { endMiles: 120000, decrease: 0.0709 },
  { endMiles: 130000, decrease: 0 },
  { endMiles: 150000, decrease: 0.0092 },
  { endMiles: 160000, decrease: 0.0931 },
  { endMiles: 170000, decrease: 0.097 },
  { endMiles: 180000, decrease: 0 },
  { endMiles: 190000, decrease: 0.0961 },
  { endMiles: 200000, decrease: 0.0743 },
  { endMiles: 210000, decrease: 0.0938 },
  { endMiles: 220000, decrease: 0.0204 },
  { endMiles: 240000, decrease: 0 },
  { endMiles: 250000, decrease: 0.0389 },
  { endMiles: 260000, decrease: 0.0203 },
  { endMiles: 270000, decrease: 0.0192 },
  { endMiles: 280000, decrease: 0 },
  { endMiles: 290000, decrease: 0.0211 },
  { endMiles: 300000, decrease: 0.0185 },
  { endMiles: 310000, decrease: 0.0204 },
  { endMiles: 320000, decrease: 0.0192 },
  { endMiles: 330000, decrease: 0 },
  { endMiles: 340000, decrease: 0.0212 },
  { endMiles: 350000, decrease: 0.02 },
  { endMiles: 360000, decrease: 0.0187 },
];

const MILEAGE_CURVE_START_MILES = 100000;

/** @type {{ miles: number, factor: number }[]} */
const MILEAGE_CURVE_KNOTS = (() => {
  /** @type {{ miles: number, factor: number }[]} */
  const knots = [{ miles: MILEAGE_CURVE_START_MILES, factor: 1 }];
  let factor = 1;
  let prev = MILEAGE_CURVE_START_MILES;
  for (const { endMiles, decrease } of MILEAGE_SEGMENT_DECREASES) {
    factor *= 1 - decrease;
    knots.push({ miles: endMiles, factor });
    prev = endMiles;
  }
  return knots;
})();

/**
 * @param {string|number} mileageInput
 * @returns {number} non-negative integer miles or NaN
 */
function parseMileageOdometer(mileageInput) {
  const n = parseInt(String(mileageInput ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * @param {number} miles
 * @param {{ miles: number, factor: number }[]} knots
 * @returns {number}
 */
function interpolateMileageFactor(miles, knots) {
  if (miles <= knots[0].miles) return knots[0].factor;
  const last = knots[knots.length - 1];
  if (miles >= last.miles) return last.factor;

  let i = 0;
  while (i < knots.length - 1 && knots[i + 1].miles < miles) i += 1;
  const a = knots[i];
  const b = knots[i + 1];
  const span = b.miles - a.miles;
  if (span <= 0) return b.factor;
  const t = (miles - a.miles) / span;
  return a.factor + t * (b.factor - a.factor);
}

/**
 * @param {string|number} mileageMidpoint — odometer miles (API field name retained)
 * @returns {number} multiplier in (0, 1], default 1 if missing/invalid
 */
function mileagePriceMultiplier(mileageMidpoint) {
  const miles = parseMileageOdometer(mileageMidpoint);
  if (!Number.isFinite(miles) || miles < 0) return 1;
  if (miles < MILEAGE_CURVE_START_MILES) return 1;
  return interpolateMileageFactor(miles, MILEAGE_CURVE_KNOTS);
}

/**
 * @deprecated Legacy bracket shape for exports; rows are curve knots (maxMiles = knot odometer).
 */
const MILEAGE_PRICE_BRACKETS = MILEAGE_CURVE_KNOTS.map(({ miles, factor }) => ({
  maxMiles: miles,
  factor,
}));

module.exports = {
  mileagePriceMultiplier,
  parseMileageOdometer,
  MILEAGE_CURVE_START_MILES,
  MILEAGE_CURVE_KNOTS,
  MILEAGE_PRICE_BRACKETS,
};
