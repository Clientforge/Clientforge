/** Sluice Drip Spa — must match backend/src/config/sluiceTenant.js */
export const SLUICE_TENANT_ID = import.meta.env.VITE_SLUICE_TENANT_ID
  || '5f793c52-f8e0-457b-97b5-86af987c2a8d';

export function isSluiceTenant(tenantId) {
  return tenantId === SLUICE_TENANT_ID;
}
