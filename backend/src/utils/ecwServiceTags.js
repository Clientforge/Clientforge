/** Auto-managed contact tags from eCW (see ecw-checkout.service). */
const ECW_SERVICE_TAG_PREFIX = 'service:';
const ECW_PRACTITIONER_TAG_PREFIX = 'provider:';

function ecwServiceTag(serviceLabel) {
  const label = String(serviceLabel || '').trim();
  if (!label) return null;
  return `${ECW_SERVICE_TAG_PREFIX}${label}`;
}

function isEcwServiceTag(tag) {
  return String(tag || '').startsWith(ECW_SERVICE_TAG_PREFIX);
}

function ecwPractitionerTag(practitionerName) {
  const name = String(practitionerName || '').trim();
  if (!name) return null;
  return `${ECW_PRACTITIONER_TAG_PREFIX}${name}`;
}

function isEcwPractitionerTag(tag) {
  return String(tag || '').startsWith(ECW_PRACTITIONER_TAG_PREFIX);
}

/** Display in UI without the internal prefix. */
function formatEcwServiceTagForDisplay(tag) {
  const s = String(tag || '');
  if (s.startsWith(ECW_SERVICE_TAG_PREFIX)) {
    return s.slice(ECW_SERVICE_TAG_PREFIX.length) || s;
  }
  return s;
}

function formatEcwPractitionerTagForDisplay(tag) {
  const s = String(tag || '');
  if (s.startsWith(ECW_PRACTITIONER_TAG_PREFIX)) {
    return s.slice(ECW_PRACTITIONER_TAG_PREFIX.length) || s;
  }
  return s;
}

function formatEcwManagedTagForDisplay(tag) {
  if (isEcwServiceTag(tag)) return formatEcwServiceTagForDisplay(tag);
  if (isEcwPractitionerTag(tag)) return formatEcwPractitionerTagForDisplay(tag);
  return String(tag || '');
}

/**
 * Keep manual tags; update eCW service and/or practitioner tags when labels are provided.
 * Omit a field to leave that managed tag unchanged.
 */
function mergeEcwEncounterTags(existingTags, { serviceLabel, practitionerName } = {}) {
  const prior = Array.isArray(existingTags) ? existingTags : [];
  const manual = prior
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => !isEcwServiceTag(t) && !isEcwPractitionerTag(t));

  const kept = [...manual];

  if (serviceLabel !== undefined && serviceLabel !== null) {
    const next = ecwServiceTag(serviceLabel);
    if (next) kept.push(next);
  } else {
    const prev = prior.find(isEcwServiceTag);
    if (prev) kept.push(prev);
  }

  if (practitionerName !== undefined && practitionerName !== null) {
    const next = ecwPractitionerTag(practitionerName);
    if (next) kept.push(next);
  } else {
    const prev = prior.find(isEcwPractitionerTag);
    if (prev) kept.push(prev);
  }

  return kept;
}

/**
 * Keep manual tags; replace any prior eCW service tag with the latest service label.
 */
function mergeEcwServiceTag(existingTags, serviceLabel) {
  return mergeEcwEncounterTags(existingTags, { serviceLabel });
}

module.exports = {
  ECW_SERVICE_TAG_PREFIX,
  ECW_PRACTITIONER_TAG_PREFIX,
  ecwServiceTag,
  ecwPractitionerTag,
  isEcwServiceTag,
  isEcwPractitionerTag,
  formatEcwServiceTagForDisplay,
  formatEcwPractitionerTagForDisplay,
  formatEcwManagedTagForDisplay,
  mergeEcwEncounterTags,
  mergeEcwServiceTag,
};
