/** Single dollar amount for customer UI. Keeps `low`/`high` for snapshots and sell intent. */

export function displayOfferUsd(result) {
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
