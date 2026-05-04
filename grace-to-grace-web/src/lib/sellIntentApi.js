import { API_PUBLIC_BASE } from '../constants.js';

function apiV1Base() {
  const base = API_PUBLIC_BASE.replace(/\/$/, '');
  if (base) return `${base}/api/v1`;
  return '/api/v1';
}

/**
 * POST Grace-to-Grace sell intent — triggers staff SMS on the API.
 */
export async function postGraceSellIntent(payload) {
  const res = await fetch(`${apiV1Base()}/public/grace-sell-intent`, {
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
