/**
 * Sluice Drip Spa — superbill checkout primary-service rules.
 * Add-ons and fee lines are extensions of the visit, not the primary service.
 */

const SLUICE_TENANT_ID = process.env.SLUICE_TENANT_ID || '5f793c52-f8e0-457b-97b5-86af987c2a8d';

const ADD_ON_PATTERN = /\badd[\s-]?on\b/i;
const FEE_LINE_PATTERNS = [
  /\bservice charge\b/i,
  /^sds\b/i,
];

function isSluiceTenant(tenantId) {
  return tenantId === SLUICE_TENANT_ID;
}

function isSluiceAddOn(serviceName) {
  return ADD_ON_PATTERN.test(String(serviceName || ''));
}

function isSluiceFeeLine(serviceName) {
  const name = String(serviceName || '');
  return FEE_LINE_PATTERNS.some((pattern) => pattern.test(name));
}

/** Lines excluded from primary selection for Sluice checkout. */
function isSluiceSecondaryLine(serviceName) {
  return isSluiceAddOn(serviceName) || isSluiceFeeLine(serviceName);
}

function filterSluicePrimaryCandidates(services) {
  return (services || []).filter((s) => !isSluiceSecondaryLine(s.serviceName));
}

module.exports = {
  SLUICE_TENANT_ID,
  isSluiceTenant,
  isSluiceAddOn,
  isSluiceFeeLine,
  isSluiceSecondaryLine,
  filterSluicePrimaryCandidates,
};
