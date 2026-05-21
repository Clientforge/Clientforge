import { API_PUBLIC_BASE } from '../constants.js';

function apiV1Base() {
  const base = API_PUBLIC_BASE.replace(/\/$/, '');
  if (base) return `${base}/api/v1`;
  return '/api/v1';
}

export async function postG2gLeadStart({ firstName, phone, email, zip, city, state, sessionId }) {
  const res = await fetch(`${apiV1Base()}/public/g2g-lead/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, phone, email, zip, city, state, sessionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not save your contact info.');
  }
  return data;
}

export async function postG2gNotifyEstimate(payload) {
  const res = await fetch(`${apiV1Base()}/public/g2g-notify-estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `Estimate notify failed (${res.status})`;
    console.warn('[g2g-notify-estimate]', msg);
    throw new Error(msg);
  }
  return data;
}
