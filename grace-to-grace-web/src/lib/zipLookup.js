/** US ZIP → city/state via Zippopotam (no API key). */
export async function lookupUsZipCityState(zipInput) {
  const digits = String(zipInput ?? '').replace(/\D/g, '').slice(0, 5);
  if (digits.length !== 5) return null;

  const res = await fetch(`https://api.zippopotam.us/us/${digits}`);
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const place = data?.places?.[0];
  if (!place) return null;

  const city = String(place['place name'] || '').trim();
  const state = String(place['state abbreviation'] || '').trim().toUpperCase();
  if (!city || state.length !== 2) return null;

  return { zip: digits, city, state };
}
