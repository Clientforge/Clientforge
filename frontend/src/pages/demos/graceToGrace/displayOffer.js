/** Customer-facing offer display. `low`/`high` and `pointOffer` stay for API, sell intent, and notifications. */

const MULTIPLIER_KEYS = [
  'operationalPriceMultiplier',
  'mileagePriceMultiplier',
  'catalyticFinalMultiplier',
  'airbagDeployedFinalMultiplier',
  'exteriorPanelDamageMultiplier',
  'batteryMissingFinalMultiplier',
  'tireConditionMultiplier',
];

function estimateMultipliers(meta) {
  if (!meta || typeof meta !== 'object') return 1;
  let product = 1;
  for (const key of MULTIPLIER_KEYS) {
    const v = Number(meta[key]);
    if (Number.isFinite(v) && v > 0) product *= v;
  }
  return product;
}

/** Full band envelope (valuation_bands meta) with same multipliers as the point estimate. */
function bandEnvelopeLoHi(result) {
  const meta = result?.meta;
  if (!meta?.worst || !meta?.best) return null;
  const mult = estimateMultipliers(meta);
  const nums = [meta.worst.min, meta.worst.max, meta.best.min, meta.best.max]
    .map((n) => Math.round(Number(n) * mult))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) return null;
  return { lo, hi };
}

/** Minimum spread when API low/high collapsed (local v1-style fallback). */
function spreadAroundPoint(point) {
  const spread = Math.max(75, Math.round(point * 0.12));
  return { lo: Math.max(0, point - spread), hi: point + spread };
}

/**
 * Dollar range to show customers under "Estimated range".
 * Uses API low/high when they differ; else band envelope from meta; else spread around offer.
 */
export function getDisplayRangeLoHi(result) {
  if (!result) return null;

  const apiLo = result.low != null ? Math.round(Number(result.low)) : null;
  const apiHi = result.high != null ? Math.round(Number(result.high)) : null;
  if (
    Number.isFinite(apiLo)
    && Number.isFinite(apiHi)
    && apiLo < apiHi
  ) {
    return { lo: apiLo, hi: apiHi };
  }

  const envelope = bandEnvelopeLoHi(result);
  if (envelope) return envelope;

  const point = formatPointOfferUsd(result);
  if (point != null && Number.isFinite(apiLo) && apiLo === apiHi) {
    return spreadAroundPoint(point);
  }

  if (Number.isFinite(apiLo) && Number.isFinite(apiHi)) {
    return { lo: apiLo, hi: apiHi };
  }

  return null;
}

export function formatPointOfferUsd(result) {
  if (!result) return null;
  if (result.pointOffer != null && Number.isFinite(Number(result.pointOffer))) {
    return Math.round(Number(result.pointOffer));
  }
  if (result.low != null && result.high != null) {
    const lo = Number(result.low);
    const hi = Number(result.high);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return Math.round((lo + hi) / 2);
  }
  return null;
}

/** @deprecated Prefer formatPointOfferUsd + formatOfferRange in UI */
export function displayOfferUsd(result) {
  return formatPointOfferUsd(result);
}

export function formatOfferRange(result) {
  const range = getDisplayRangeLoHi(result);
  if (!range) return null;
  if (range.lo === range.hi) return `$${range.lo.toLocaleString()}`;
  return `$${range.lo.toLocaleString()} – $${range.hi.toLocaleString()}`;
}

export function formatPointOffer(result) {
  const n = formatPointOfferUsd(result);
  return n != null ? `$${n.toLocaleString()}` : null;
}

export function hasDisplayableOffer(result) {
  return Boolean(formatOfferRange(result) || formatPointOffer(result));
}
