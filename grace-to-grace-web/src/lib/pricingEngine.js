/**
 * v1 pricing — deterministic stubs for demo. Replace with market API + scrap module later.
 */

export const CONDITION_OPTIONS = [
  { id: 'runs', label: 'Runs & drives', factor: 1.0 },
  { id: 'minor_damage', label: 'Minor damage', factor: 0.75 },
  { id: 'major_damage', label: 'Major damage', factor: 0.5 },
  { id: 'non_running', label: 'Non-running', factor: 0.35 },
  { id: 'flood_fire', label: 'Flood / fire / salvage', factor: 0.2 },
];

const FACTOR_BY_ID = Object.fromEntries(CONDITION_OPTIONS.map((o) => [o.id, o.factor]));

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

/**
 * @param {object} input
 * @param {string} input.year
 * @param {string} [input.bodyClass]
 * @param {string} input.conditionId
 * @param {string} [input.zip]
 * @param {string} [input.mileage] — optional stub; higher mileage lowers band slightly in v1
 */
export function computeOfferRange(input) {
  const cls = classifyBody(input.bodyClass);
  let base = CLASS_BASE_USD[cls] ?? CLASS_BASE_USD.default;
  base *= ageFactor(input.year);
  base *= zipVariance(input.zip);

  const mileage = parseInt(String(input.mileage || '').replace(/\D/g, ''), 10);
  if (!Number.isNaN(mileage) && mileage > 0) {
    const milesFactor = Math.max(0.65, 1 - Math.min(mileage, 250000) / 500000);
    base *= milesFactor;
  }

  const conditionFactor = FACTOR_BY_ID[input.conditionId] ?? 0.5;
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
