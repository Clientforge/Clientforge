/**
 * Grace / G2G — mileage bracket → price multiplier.
 * Final dollars = base (condition-only interpolated price, or Camry base, etc.) × multiplier.
 *
 * Uses mileage midpoint from the flow (numeric string, e.g. "75000").
 */

/** First matching tier where miles <= maxMiles (inclusive upper bound per row). */
const MILEAGE_PRICE_BRACKETS = [
  { maxMiles: 50000, factor: 1.0 },
  { maxMiles: 100000, factor: 0.85 },
  { maxMiles: 150000, factor: 0.7 },
  { maxMiles: 200000, factor: 0.55 },
  { maxMiles: 250000, factor: 0.45 },
  { maxMiles: 300000, factor: 0.38 },
  { maxMiles: Infinity, factor: 0.32 },
];

/**
 * @param {string|number} mileageMidpoint
 * @returns {number} multiplier in (0, 1], default 1 if missing/invalid
 */
function mileagePriceMultiplier(mileageMidpoint) {
  const n = parseInt(String(mileageMidpoint ?? '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const row = MILEAGE_PRICE_BRACKETS.find((r) => n <= r.maxMiles);
  return row ? row.factor : 0.32;
}

module.exports = {
  mileagePriceMultiplier,
  MILEAGE_PRICE_BRACKETS,
};
