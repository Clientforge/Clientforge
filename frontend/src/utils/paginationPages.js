/**
 * Returns page items for compact pagination: numbers 1..totalPages plus 'ellipsis' gaps.
 * @param {number} current - 1-based current page
 * @param {number} totalPages
 * @param {number} [siblingCount=1] - pages shown on each side of current
 */
export function getPaginationItems(current, totalPages, siblingCount = 1) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items = [];
  const left = Math.max(2, current - siblingCount);
  const right = Math.min(totalPages - 1, current + siblingCount);

  items.push(1);

  if (left > 2) {
    items.push('ellipsis');
  }

  for (let p = left; p <= right; p += 1) {
    items.push(p);
  }

  if (right < totalPages - 1) {
    items.push('ellipsis');
  }

  items.push(totalPages);
  return items;
}

export function paginationRange(page, limit, total) {
  const safeTotal = total ?? 0;
  const safeLimit = limit || 25;
  const safePage = page || 1;
  if (safeTotal === 0) {
    return { start: 0, end: 0 };
  }
  const start = (safePage - 1) * safeLimit + 1;
  const end = Math.min(safePage * safeLimit, safeTotal);
  return { start, end };
}