const apiBase = () => (import.meta.env.PROD ? '/api/v1' : 'http://localhost:3000/api/v1');

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
