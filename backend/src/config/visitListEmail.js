/**
 * Bay Area Heart (and future tenants): CSV visit list via info@clientforge-ai.com
 */
function isVisitListEmailEnabled() {
  return process.env.VISIT_LIST_EMAIL_ENABLED === 'true';
}

function allowedFromAddresses() {
  const raw = (process.env.VISIT_LIST_EMAIL_ALLOWED_FROM || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function extractEmailAddress(fromRaw) {
  const text = String(fromRaw || '').trim().toLowerCase();
  if (!text) return '';
  const angle = text.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  if (text.includes('@')) return text;
  return '';
}

function isSenderAllowed(fromAddress) {
  const allowed = allowedFromAddresses();
  if (allowed.length === 0) return false;
  const email = extractEmailAddress(fromAddress);
  if (!email) return false;
  return allowed.some((entry) => {
    if (entry.startsWith('@')) {
      return email.endsWith(entry);
    }
    return email === entry;
  });
}

module.exports = {
  isVisitListEmailEnabled,
  allowedFromAddresses,
  extractEmailAddress,
  isSenderAllowed,
};
