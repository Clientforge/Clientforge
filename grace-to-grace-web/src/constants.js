export const BRAND = 'Grace to Grace';
export const TAGLINE = 'Instant estimated offers for junk, damaged & scrap vehicles.';

export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL || 'hello@gracetograce.example.com';

/**
 * Optional production override for VIN decode (full URL, no trailing slash).
 * If unset and built for ClientForge same-origin deploy, requests use `/api/v1/public/vin-decode/:vin`.
 * Set when the static site is on a different host than the API.
 */
export const VIN_DECODE_BASE = import.meta.env.VITE_VIN_DECODE_BASE || '';

/**
 * Optional API origin for sell-intent + shared endpoints (no trailing slash).
 * Empty = same origin or Vite `/api` proxy to localhost:3000 in dev.
 */
export const API_PUBLIC_BASE = import.meta.env.VITE_API_PUBLIC_BASE || '';
