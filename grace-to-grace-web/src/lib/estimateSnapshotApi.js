import { API_PUBLIC_BASE } from '../constants.js';

function apiV1Base() {
  const base = API_PUBLIC_BASE.replace(/\/$/, '');
  if (base) return `${base}/api/v1`;
  return '/api/v1';
}

export function getOrCreateG2gSessionId() {
  const k = 'g2g_session_id';
  try {
    let id = localStorage.getItem(k);
    if (!id && typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
      localStorage.setItem(k, id);
    }
    return id || `sess_${Date.now()}`;
  } catch {
    return `sess_${Date.now()}`;
  }
}

/** Record estimate view (local engine) for funnel analytics — fails silently in UI. */
export async function postGraceEstimateSnapshot({ sessionId, input, result }) {
  const res = await fetch(`${apiV1Base()}/public/grace-estimate-snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, input, result }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[g2g-snapshot]', data.error || res.status);
  }
  return data;
}
