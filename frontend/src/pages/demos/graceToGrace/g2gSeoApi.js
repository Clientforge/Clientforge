const apiBase = () => (import.meta.env.PROD ? '/api/v1/public' : 'http://localhost:3000/api/v1/public');

export async function fetchG2gLocations() {
  const res = await fetch(`${apiBase()}/g2g/locations`);
  if (!res.ok) throw new Error('Could not load locations');
  const data = await res.json();
  return data.locations || [];
}

export async function fetchG2gLocation(slug) {
  const res = await fetch(`${apiBase()}/g2g/locations/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load location');
  const data = await res.json();
  return data.location || null;
}
