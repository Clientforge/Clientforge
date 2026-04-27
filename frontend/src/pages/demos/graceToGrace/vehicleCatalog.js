/**
 * Curated US-market makes/models for G2G guided entry.
 * Values are title-case; matching helpers normalize for VIN decode and submit.
 */

export const OTHER_VALUE = '__other__';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_MODEL_YEAR = 1990;

/** Descending year strings, e.g. "2026", "2025", … */
export const VEHICLE_YEARS = (() => {
  const out = [];
  for (let y = CURRENT_YEAR + 1; y >= MIN_MODEL_YEAR; y -= 1) {
    out.push(String(y));
  }
  return out;
})();

/** @type {Record<string, string[]>} */
export const MODELS_BY_MAKE = {
  Acura: ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'RLX', 'TLX', 'ZDX'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q4', 'Q5', 'Q7', 'Q8', 'S4', 'S5', 'TT'],
  BMW: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'M3', 'M4', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4'],
  Buick: ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal', 'Verano'],
  Cadillac: ['ATS', 'CT4', 'CT5', 'CT6', 'CTS', 'Escalade', 'SRX', 'XT4', 'XT5', 'XT6', 'XTS'],
  Chevrolet: [
    'Blazer',
    'Camaro',
    'Colorado',
    'Corvette',
    'Cruze',
    'Equinox',
    'Express',
    'Impala',
    'Malibu',
    'Silverado 1500',
    'Silverado 2500',
    'Suburban',
    'Tahoe',
    'Traverse',
    'Trax',
  ],
  Chrysler: ['200', '300', 'Pacifica', 'Voyager'],
  Dodge: ['Avenger', 'Caliber', 'Challenger', 'Charger', 'Dart', 'Durango', 'Grand Caravan', 'Journey', 'Nitro'],
  Ford: [
    'Bronco',
    'Bronco Sport',
    'Edge',
    'Escape',
    'Expedition',
    'Explorer',
    'F-150',
    'F-250',
    'F-350',
    'Fiesta',
    'Focus',
    'Fusion',
    'Mustang',
    'Ranger',
  ],
  GMC: ['Acadia', 'Canyon', 'Hummer EV', 'Savana', 'Sierra 1500', 'Sierra 2500', 'Terrain', 'Yukon'],
  Honda: [
    'Accord',
    'Civic',
    'Clarity',
    'CR-V',
    'Crosstour',
    'Element',
    'Fit',
    'HR-V',
    'Insight',
    'Odyssey',
    'Passport',
    'Pilot',
    'Ridgeline',
  ],
  Hyundai: ['Accent', 'Elantra', 'Entourage', 'Genesis Coupe', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Nexo', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson', 'Veloster', 'Venue'],
  Infiniti: ['EX', 'FX', 'G', 'JX', 'M', 'Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX60', 'QX70', 'QX80'],
  Jeep: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Liberty', 'Patriot', 'Renegade', 'Wrangler'],
  Kia: ['Cadenza', 'Carnival', 'Forte', 'K5', 'Niro', 'Optima', 'Rio', 'Sedona', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
  Lexus: ['CT', 'ES', 'GS', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'SC', 'UX'],
  Mazda: ['2', '3', '5', '6', 'CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-7', 'CX-9', 'MPV', 'MX-5 Miata', 'Protege', 'Tribute'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'CL', 'CLA', 'CLK', 'CLS', 'E-Class', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'M-Class', 'S-Class', 'SL', 'SLK', 'Sprinter'],
  Nissan: [
    '370Z',
    'Altima',
    'Armada',
    'Frontier',
    'GT-R',
    'Juke',
    'Kicks',
    'LEAF',
    'Maxima',
    'Murano',
    'NV',
    'Pathfinder',
    'Quest',
    'Rogue',
    'Sentra',
    'Titan',
    'Versa',
    'Xterra',
  ],
  Ram: ['1500', '2500', '3500', 'C/V', 'Dakota', 'ProMaster'],
  Subaru: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'SVX', 'Tribeca', 'WRX', 'XV'],
  Tesla: ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
  Toyota: [
    '4Runner',
    'Avalon',
    'C-HR',
    'Camry',
    'Celica',
    'Corolla',
    'Crown',
    'Echo',
    'FJ Cruiser',
    'GR86',
    'Highlander',
    'Land Cruiser',
    'Matrix',
    'Mirai',
    'MR2',
    'Prius',
    'RAV4',
    'Sequoia',
    'Sienna',
    'Solara',
    'Supra',
    'Tacoma',
    'Tundra',
    'Venza',
    'Yaris',
  ],
  Volkswagen: ['Arteon', 'Atlas', 'Beetle', 'CC', 'Eos', 'Golf', 'GTI', 'ID.4', 'Jetta', 'Passat', 'Routan', 'Tiguan', 'Touareg'],
  Volvo: ['C30', 'C40', 'C70', 'S40', 'S60', 'S80', 'S90', 'V50', 'V60', 'V90', 'XC40', 'XC60', 'XC70', 'XC90'],
};

export const VEHICLE_MAKES = Object.keys(MODELS_BY_MAKE).sort((a, b) => a.localeCompare(b));

/**
 * @param {string} raw
 * @returns {string | null} canonical make or null
 */
export function matchMakeToCatalog(raw) {
  const t = String(raw || '')
    .trim()
    .toLowerCase();
  if (!t) return null;
  for (const m of VEHICLE_MAKES) {
    if (m.toLowerCase() === t) return m;
  }
  for (const m of VEHICLE_MAKES) {
    if (t.includes(m.toLowerCase()) || m.toLowerCase().includes(t)) return m;
  }
  return null;
}

/**
 * @param {string} make - canonical
 * @param {string} raw
 * @returns {string | null} canonical model or null
 */
export function matchModelToCatalog(make, raw) {
  const list = MODELS_BY_MAKE[make];
  if (!list || !raw) return null;
  const t = String(raw)
    .trim()
    .toLowerCase();
  for (const model of list) {
    const ml = model.toLowerCase();
    if (ml === t) return model;
  }
  for (const model of list) {
    const ml = model.toLowerCase();
    if (t.startsWith(ml) || ml.startsWith(t) || t.includes(ml) || ml.includes(t)) {
      return model;
    }
  }
  return null;
}

/**
 * If decoded year is outside our range, return nearest boundary year string.
 * @param {string} y
 * @returns {string}
 */
export function coerceDecodedYear(y) {
  const n = parseInt(String(y || '').replace(/\D/g, ''), 10);
  if (Number.isNaN(n)) return '';
  const min = parseInt(VEHICLE_YEARS[VEHICLE_YEARS.length - 1], 10);
  const max = parseInt(VEHICLE_YEARS[0], 10);
  const clamped = Math.min(max, Math.max(min, n));
  return String(clamped);
}
