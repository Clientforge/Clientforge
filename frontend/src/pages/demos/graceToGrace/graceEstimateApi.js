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

/** Contact capture before vehicle step — creates/updates CRM lead. */
export async function postG2gLeadStart({ firstName, phone, email, sessionId }) {
  const res = await fetch(`${apiBase()}/public/g2g-lead/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, phone, email, sessionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not save your contact info.');
  }
  return data;
}

/** Internal team alert when estimate is generated. */
export async function postG2gNotifyEstimate(payload) {
  const res = await fetch(`${apiBase()}/public/g2g-notify-estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[g2g-notify-estimate]', data.error || res.status);
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
