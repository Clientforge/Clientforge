/** Customer-facing offer display. `low`/`high` and `pointOffer` stay for API, sell intent, and notifications. */

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
  if (result?.low == null || result?.high == null) return null;
  const lo = Math.round(Number(result.low));
  const hi = Math.round(Number(result.high));
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo === hi) return `$${lo.toLocaleString()}`;
  return `$${lo.toLocaleString()} – $${hi.toLocaleString()}`;
}

export function formatPointOffer(result) {
  const n = formatPointOfferUsd(result);
  return n != null ? `$${n.toLocaleString()}` : null;
}

export function hasDisplayableOffer(result) {
  return Boolean(formatOfferRange(result) || formatPointOffer(result));
}
