const SESSION_KEY = 'g2g_session_id';

export function getOrCreateG2gSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id && typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id || `sess_${Date.now()}`;
  } catch {
    return `sess_${Date.now()}`;
  }
}
