/** Sluice Drip Spa — must match backend/src/config/sluiceTenant.js */
export const SLUICE_TENANT_ID = import.meta.env.VITE_SLUICE_TENANT_ID
  || '5f793c52-f8e0-457b-97b5-86af987c2a8d';

export function isSluiceTenant(tenantOrId) {
  if (tenantOrId && typeof tenantOrId === 'object') {
    if (tenantOrId.id === SLUICE_TENANT_ID) return true;
    return /sluice drip/i.test(tenantOrId.name || '');
  }
  return tenantOrId === SLUICE_TENANT_ID;
}
