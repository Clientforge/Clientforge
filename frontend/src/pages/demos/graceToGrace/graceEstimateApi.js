const apiBase = () => (import.meta.env.PROD ? '/api/v1' : 'http://localhost:3000/api/v1');

/**
 * Server-side Grace v1 estimate (title, scrap index, market proxy).
 * Uses unauthenticated fetch so missing JWT does not redirect to /login.
 */
export async function postGraceEstimate(payload) {
  const res = await fetch(`${apiBase()}/public/grace-estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not calculate estimate.');
  }
  return data;
}

/** Grace to Grace — staff SMS when customer submits "Sell now" after an estimate. */
export async function postGraceSellIntent(payload) {
  const res = await fetch(`${apiBase()}/public/grace-sell-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not send request. Try again or call us.');
  }
  return data;
}
