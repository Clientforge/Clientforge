/**
 * Shopmonkey integration — tenant allowlist (Southlake Autocare first).
 *
 * Set SHOPMONKEY_TENANT_ID in env to pin a specific tenant UUID in production.
 * Otherwise matches tenant name containing "southlake" or "autocare".
 */

const SHOPMONKEY_TENANT_ID = process.env.SHOPMONKEY_TENANT_ID || null;

function isShopmonkeyTenant(tenantId, tenantName) {
  if (!tenantId) return false;
  if (SHOPMONKEY_TENANT_ID) return tenantId === SHOPMONKEY_TENANT_ID;
  const name = String(tenantName || '').toLowerCase();
  return name.includes('southlake') || name.includes('autocare');
}

module.exports = {
  SHOPMONKEY_TENANT_ID,
  isShopmonkeyTenant,
};
