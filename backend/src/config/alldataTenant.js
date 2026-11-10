/**
 * ALLDATA Manage Online — tenant allowlist (Powder Springs first).
 *
 * Set ALLDATA_TENANT_ID in env to pin a specific tenant UUID in production.
 * Otherwise matches tenant name containing "powder springs" or "powder" + "brake".
 */

const ALLDATA_TENANT_ID = process.env.ALLDATA_TENANT_ID || null;

function isAlldataTenant(tenantId, tenantName) {
  if (!tenantId) return false;
  if (ALLDATA_TENANT_ID) return tenantId === ALLDATA_TENANT_ID;
  const name = String(tenantName || '').toLowerCase();
  if (name.includes('powder springs') || name.includes('powder_springs')) return true;
  return name.includes('powder') && name.includes('brake');
}

module.exports = {
  ALLDATA_TENANT_ID,
  isAlldataTenant,
};
