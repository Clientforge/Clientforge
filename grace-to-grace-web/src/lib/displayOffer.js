/** Customer-facing offer display (local pricing engine + optional API fields). */

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

function spreadAroundPoint(point) {
  const spread = Math.max(75, Math.round(point * 0.12));
  return { lo: Math.max(0, point - spread), hi: point + spread };
}

export function getDisplayRangeLoHi(result) {
  if (!result) return null;
  const lo = result.low != null ? Math.round(Number(result.low)) : null;
  const hi = result.high != null ? Math.round(Number(result.high)) : null;
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo < hi) {
    return { lo, hi };
  }
  const point = formatPointOfferUsd(result);
  if (point != null && Number.isFinite(lo) && lo === hi) {
    return spreadAroundPoint(point);
  }
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    return { lo, hi };
  }
  return null;
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
