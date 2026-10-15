const KEY = 'g2g_seo_location_slug';

export function saveG2gSeoLocationSlug(slug) {
  if (!slug) return;
  try {
    sessionStorage.setItem(KEY, String(slug).trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function loadG2gSeoLocationSlug() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
