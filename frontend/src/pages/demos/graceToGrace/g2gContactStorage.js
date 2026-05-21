const STORAGE_KEY = 'g2g_contact';

export function loadG2gContact() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.firstName || !data?.phone || !data?.email || !data?.zip) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveG2gContact(contact) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
  } catch {
    /* ignore */
  }
}
