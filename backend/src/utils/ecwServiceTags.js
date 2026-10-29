/** Auto-managed contact tags from eCW visit service (see ecw-checkout.service). */
const ECW_SERVICE_TAG_PREFIX = 'service:';

function ecwServiceTag(serviceLabel) {
  const label = String(serviceLabel || '').trim();
  if (!label) return null;
  return `${ECW_SERVICE_TAG_PREFIX}${label}`;
}

function isEcwServiceTag(tag) {
  return String(tag || '').startsWith(ECW_SERVICE_TAG_PREFIX);
}

/** Display in UI without the internal prefix. */
function formatEcwServiceTagForDisplay(tag) {
  const s = String(tag || '');
  if (s.startsWith(ECW_SERVICE_TAG_PREFIX)) {
    return s.slice(ECW_SERVICE_TAG_PREFIX.length) || s;
  }
  return s;
}

/**
 * Keep manual tags; replace any prior eCW service tag with the latest service label.
 */
function mergeEcwServiceTag(existingTags, serviceLabel) {
  const kept = (Array.isArray(existingTags) ? existingTags : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => !isEcwServiceTag(t));

  const next = ecwServiceTag(serviceLabel);
  if (next) kept.push(next);
  return kept;
}

module.exports = {
  ECW_SERVICE_TAG_PREFIX,
  ecwServiceTag,
  isEcwServiceTag,
  formatEcwServiceTagForDisplay,
  mergeEcwServiceTag,
};
