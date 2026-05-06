/**
 * Grace to Grace — UI constants and labels.
 * Dollar math runs on the server (`POST /api/v1/public/grace-estimate`).
 */

export const CONDITION_OPTIONS = [
  { id: 'runs', label: 'Runs & drives', factor: 1.0 },
  { id: 'minor_damage', label: 'Minor damage', factor: 0.75 },
  { id: 'major_damage', label: 'Major damage', factor: 0.5 },
  { id: 'non_running', label: 'Non-running', factor: 0.35 },
  { id: 'flood_fire', label: 'Flood / fire / salvage', factor: 0.2 },
];

/** Seller-reported title — factors applied server-side (see gracePricingV1.service.js). */
export const TITLE_STATUS_OPTIONS = [
  { id: 'clean', label: 'Clean / clear title' },
  { id: 'rebuilt', label: 'Rebuilt title' },
  { id: 'salvage', label: 'Salvage title' },
  { id: 'parts_only', label: 'Parts-only / non-repairable' },
  { id: 'missing_unknown', label: 'Missing or unknown title' },
  { id: 'lien_reported', label: 'Lien or loan reported (disclosed)' },
];

/**
 * Exact odometer (miles) for API + display. Server accepts digits-only strings.
 */
export const MAX_ODOMETER_MILES = 999999;

export function parseMileageInput(raw) {
  const n = parseInt(String(raw ?? '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_ODOMETER_MILES) return null;
  return n;
}

export function formatMileageDisplay(miles) {
  if (miles == null || !Number.isFinite(miles)) return '—';
  return `${Number(miles).toLocaleString()} mi`;
}

/** Single tire question — sent as `assessment.tireCondition` (see graceTirePricing.service). */
export const TIRE_CONDITION = {
  all_ok: 'all_ok',
  flat: 'flat',
  missing: 'missing',
};

export const BODY_PANEL_KEYS = [
  'front',
  'rear',
  'left',
  'right',
  'engine',
  'flood',
  'fire',
  'glass',
  'airbag',
];

/** Per-area “none / some” (glass & airbag use custom copy in the offer form). */
export const BODY_STRUCTURAL_KEYS = ['front', 'rear', 'left', 'right', 'engine', 'flood', 'fire'];

export const BODY_PANEL_LABELS = {
  front: 'Front',
  rear: 'Rear',
  left: 'Left side',
  right: 'Right side',
  engine: 'Engine',
  flood: 'Flood',
  fire: 'Fire',
  glass: 'Glass, mirrors & lights',
  airbag: 'Airbag',
};

export const START_DRIVE = {
  starts_drives: 'starts_drives',
  starts_not_drives: 'starts_not_drives',
  does_not_start: 'does_not_start',
};

export const EXTERIOR = {
  no_major: 'no_major',
  rust_or_damage: 'rust_or_damage',
};

export const EXTERIOR_COMPLETE = {
  all: 'all',
  incomplete: 'incomplete',
};

export const CATALYTIC = {
  present: 'present',
  missing: 'missing',
};

/** Interior — server maps to valuation-band tier scoring. */
export const INTERIOR_QUALITY = {
  clean: 'clean',
  damaged: 'damaged',
};
