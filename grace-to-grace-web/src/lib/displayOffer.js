/** Customer-facing offer display (local pricing engine + optional API fields). */

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

function spreadAroundPoint(point) {
  const spread = Math.max(75, Math.round(point * 0.12));
  return { lo: Math.max(0, point - spread), hi: point + spread };
}

function ensureSpreadRange(range, anchor) {
  if (!range || !Number.isFinite(range.lo) || !Number.isFinite(range.hi)) return null;
  if (range.lo < range.hi) return range;
  const center = Number.isFinite(anchor) ? anchor : range.lo;
  if (!Number.isFinite(center)) return null;
  return spreadAroundPoint(center);
}

export function anchorPriceUsd(result) {
  if (!result) return null;
  if (result.pointOffer != null && Number.isFinite(Number(result.pointOffer))) {
    return Math.round(Number(result.pointOffer));
  }
  if (result.low != null && result.high != null) {
    const lo = Math.round(Number(result.low));
    const hi = Math.round(Number(result.high));
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      if (lo === hi) return lo;
      return Math.round((lo + hi) / 2);
    }
  }
  return null;
}

export function getDisplayRangeLoHi(result) {
  if (!result) return null;

  const apiLo = result.low != null ? Math.round(Number(result.low)) : null;
  const apiHi = result.high != null ? Math.round(Number(result.high)) : null;
  const anchor = anchorPriceUsd(result);

  if (Number.isFinite(apiLo) && Number.isFinite(apiHi) && apiLo < apiHi) {
    return { lo: apiLo, hi: apiHi };
  }

  const envelope = bandEnvelopeLoHi(result);
  if (envelope) {
    const widened = ensureSpreadRange(envelope, anchor);
    if (widened) return widened;
  }

  if (anchor != null) {
    return spreadAroundPoint(anchor);
  }

  if (Number.isFinite(apiLo) && Number.isFinite(apiHi)) {
    return ensureSpreadRange({ lo: apiLo, hi: apiHi }, null);
  }

  return null;
}

export function formatPointOfferUsd(result) {
  if (!result) return null;
  if (result.pointOffer != null && Number.isFinite(Number(result.pointOffer))) {
    return Math.round(Number(result.pointOffer));
  }
  if (result.low == null || result.high == null) return null;
  const lo = Number(result.low);
  const hi = Number(result.high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return Math.round((lo + hi) / 2);
}

export function displayOfferUsd(result) {
  return formatPointOfferUsd(result);
}

export function formatOfferRange(result) {
  const range = getDisplayRangeLoHi(result);
  if (!range || range.lo >= range.hi) return null;
  return `$${range.lo.toLocaleString()} – $${range.hi.toLocaleString()}`;
}

export function formatPointOffer(result) {
  const n = formatPointOfferUsd(result);
  return n != null ? `$${n.toLocaleString()}` : null;
}

export function hasDisplayableOffer(result) {
  return Boolean(formatOfferRange(result));
}
