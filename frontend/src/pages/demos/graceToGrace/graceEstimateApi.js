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
