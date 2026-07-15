/**
 * Sluice Drip Spa — tenant-scoped feature flags and IDs.
 */

const SLUICE_TENANT_ID = process.env.SLUICE_TENANT_ID || '5f793c52-f8e0-457b-97b5-86af987c2a8d';

function isSluiceTenant(tenantId) {
  return tenantId === SLUICE_TENANT_ID;
}

module.exports = {
  SLUICE_TENANT_ID,
  isSluiceTenant,
};
