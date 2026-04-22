export const CONDITION_OPTIONS = [
  { id: 'runs', label: 'Runs & drives', factor: 1.0 },
  { id: 'minor_damage', label: 'Minor damage', factor: 0.75 },
  { id: 'major_damage', label: 'Major damage', factor: 0.5 },
  { id: 'non_running', label: 'Non-running', factor: 0.35 },
  { id: 'flood_fire', label: 'Flood / fire / salvage', factor: 0.2 },
];

const FACTOR_BY_ID = Object.fromEntries(CONDITION_OPTIONS.map((o) => [o.id, o.factor]));

/** Select values = odometer midpoint for depreciation */
export const MILEAGE_SELECT_OPTIONS = [
  { value: '', label: 'Select mileage' },
  { value: '35000', label: 'Under 50,000' },
  { value: '75000', label: '50,000 – 100,000' },
  { value: '125000', label: '100,000 – 150,000' },
  { value: '175000', label: '150,000 – 200,000' },
  { value: '225000', label: '200,000+' },
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

export const BODY_PANEL_LABELS = {
  front: 'Front',
  rear: 'Rear',
  left: 'Left side',
  right: 'Right side',
  engine: 'Engine',
  flood: 'Flood',
  fire: 'Fire',
  glass: 'Glass',
  airbag: 'Airbag',
};

/**
 * Car Conditions + Body Condition → single multiplier (demo v1).
 * @param {object} [assessment]
 * @param {'yes'|'no'} [assessment.drives]
 * @param {'yes'|'no'} [assessment.tiresInflated]
 * @param {'yes'|'no'} [assessment.tiresAttached]
 * @param {Record<string, 'none'|'some'>} [assessment.body]
 */
export function deriveConditionFactor(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  const drives = a.drives === 'no' ? 'no' : 'yes';
  const tiresInflated = a.tiresInflated === 'no' ? 'no' : 'yes';
  const tiresAttached = a.tiresAttached === 'no' ? 'no' : 'yes';
  const body = a.body && typeof a.body === 'object' ? a.body : {};

  let f = 1;
  if (drives === 'no') f *= 0.36;
  if (tiresInflated === 'no') f *= 0.88;
  if (tiresAttached === 'no') f *= 0.82;

  for (const k of ['front', 'rear', 'left', 'right']) {
    if (body[k] === 'some') f *= 0.94;
  }
  if (body.engine === 'some') f *= 0.72;
  if (body.flood === 'some') f *= 0.42;
  if (body.fire === 'some') f *= 0.38;
  if (body.glass === 'some') f *= 0.9;
  if (body.airbag === 'some') f *= 0.86;

  return Math.max(0.12, Math.min(1, f));
}

const CLASS_BASE_USD = {
  pickup: 4200,
  suv: 3800,
  van: 3400,
  default: 3200,
};

export function classifyBody(bodyClass) {
  const b = String(bodyClass || '').toLowerCase();
  if (b.includes('pickup') || b.includes('truck')) return 'pickup';
  if (b.includes('sport utility') || b.includes('suv') || b.includes('multipurpose')) return 'suv';
  if (b.includes('van')) return 'van';
  return 'default';
}

function ageFactor(year) {
  const y = parseInt(year, 10);
  if (Number.isNaN(y)) return 0.5;
  const age = Math.max(0, new Date().getFullYear() - y);
  return Math.max(0.12, 1 - age * 0.055);
}

function zipVariance(zip) {
  const z = String(zip || '').replace(/\D/g, '').slice(0, 5);
  if (z.length < 5) return 1;
  const n = parseInt(z.slice(0, 3), 10);
  if (Number.isNaN(n)) return 1;
  return 0.92 + ((n % 17) / 100) * 0.2;
}

const SCRAP_FLOOR_BY_CLASS = {
  pickup: 480,
  suv: 420,
  van: 400,
  default: 350,
};

export function computeOfferRange(input) {
  const cls = classifyBody(input.bodyClass);
  let base = CLASS_BASE_USD[cls] ?? CLASS_BASE_USD.default;
  base *= ageFactor(input.year);
  base *= zipVariance(input.zip);

  const mid = parseInt(String(input.mileageMidpoint ?? ''), 10);
  const fromFree = parseInt(String(input.mileage || '').replace(/\D/g, ''), 10);
  const mileage = !Number.isNaN(mid) && mid > 0 ? mid : fromFree;
  if (!Number.isNaN(mileage) && mileage > 0) {
    const milesFactor = Math.max(0.65, 1 - Math.min(mileage, 250000) / 500000);
    base *= milesFactor;
  }

  const conditionFactor =
    input.assessment != null
      ? deriveConditionFactor(input.assessment)
      : FACTOR_BY_ID[input.conditionId] ?? 0.5;
  const adjusted = base * conditionFactor;
  const scrapFloor = SCRAP_FLOOR_BY_CLASS[cls] ?? SCRAP_FLOOR_BY_CLASS.default;

  const low = Math.max(scrapFloor, Math.round(adjusted * 0.72));
  const high = Math.max(low + 75, Math.round(adjusted * 1.12));

  return {
    low,
    high,
    meta: {
      vehicleClass: cls,
      conditionFactor,
      scrapFloor,
      baseBeforeCondition: Math.round(base),
      adjustedBeforeRound: adjusted,
    },
  };
}
