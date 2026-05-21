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
export async function postG2gLeadStart({ firstName, phone, email, zip, city, state, sessionId }) {
  const res = await fetch(`${apiBase()}/public/g2g-lead/start`, {
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

/** Vehicle photos after estimate — creates submission + team review link. */
export async function postG2gPhotoSubmission({ leadId, sessionId, contact, vehicle, estimate, photos }) {
  const form = new FormData();
  if (leadId) form.append('leadId', leadId);
  if (sessionId) form.append('sessionId', sessionId);
  form.append('contact', JSON.stringify(contact));
  form.append('vehicle', JSON.stringify(vehicle));
  form.append('estimate', JSON.stringify(estimate));
  for (const file of photos) {
    form.append('photos', file);
  }
  const res = await fetch(`${apiBase()}/public/g2g-photo-submission`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not upload photos.');
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
