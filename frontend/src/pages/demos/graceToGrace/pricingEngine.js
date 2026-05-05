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

/** Select values = odometer midpoint for depreciation */
export const MILEAGE_SELECT_OPTIONS = [
  { value: '', label: 'Select mileage' },
  { value: '25000', label: '0 – 50,000' },
  { value: '75000', label: '50,000 – 100,000' },
  { value: '125000', label: '100,000 – 150,000' },
  { value: '175000', label: '150,000 – 200,000' },
  { value: '225000', label: '200,000 – 250,000' },
  { value: '275000', label: '250,000 – 300,000' },
  { value: '325000', label: '300,000+' },
];

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
