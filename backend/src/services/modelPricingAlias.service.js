/**
 * Maps free-text trims (e.g. 328i, C300) to parent model names that exist in
 * `vehicle_valuation_bands` so tiered band lookup can fall back from exact → base.
 */

function normSpace(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} make
 * @returns {string}
 */
function makeKeyForAlias(make) {
  const m = String(make || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
  if (m.includes('mercedes')) return 'mercedes-benz';
  return m;
}

/** @type {Record<string, Record<string, string>>} */
const TRIM_TO_BAND_MODEL = {
  bmw: {
    '128i': '1 Series',
    '135i': '1 Series',
    '118i': '1 Series',
    '120i': '1 Series',
    '125i': '1 Series',
    m135i: '1 Series',
    '228i': '2 Series',
    '230i': '2 Series',
    '235i': '2 Series',
    m235i: '2 Series',
    m240i: '2 Series',
    '220i': '2 Series',
    '318i': '3 Series',
    '318ti': '3 Series',
    '320i': '3 Series',
    '323i': '3 Series',
    '325i': '3 Series',
    '325xi': '3 Series',
    '328i': '3 Series',
    '328d': '3 Series',
    '328xi': '3 Series',
    '330i': '3 Series',
    '330e': '3 Series',
    '330xi': '3 Series',
    '335i': '3 Series',
    '335xi': '3 Series',
    '340i': '3 Series',
    m340i: '3 Series',
    'activehybrid 3': '3 Series',
    '428i': '4 Series',
    '430i': '4 Series',
    '435i': '4 Series',
    '440i': '4 Series',
    '525i': '5 Series',
    '528i': '5 Series',
    '530i': '5 Series',
    '535i': '5 Series',
    '535d': '5 Series',
    '540i': '5 Series',
    '550i': '5 Series',
    m550i: '5 Series',
    '640i': '6 Series',
    '650i': '6 Series',
    '740i': '7 Series',
    '745i': '7 Series',
    '750i': '7 Series',
    '760i': '7 Series',
    x1: 'X1',
    x3: 'X3',
    x4: 'X4',
    x5: 'X5',
    x6: 'X6',
    x7: 'X7',
  },
  lexus: {
    is200t: 'IS',
    is250: 'IS',
    is300: 'IS',
    is350: 'IS',
    is500: 'IS',
    isf: 'IS',
    es300: 'ES',
    es300h: 'ES',
    es330: 'ES',
    es350: 'ES',
    gx460: 'GX',
    gx470: 'GX',
    lx470: 'LX',
    lx570: 'LX',
    rc200t: 'RC',
    rc300: 'RC',
    rc350: 'RC',
    nx200t: 'NX',
    nx300: 'NX',
    nx350: 'NX',
    rx350: 'RX',
    rx400h: 'RX',
    rx450h: 'RX',
    rx350l: 'RX',
  },
};

/**
 * Mercedes-Benz: token patterns for bands that use names like C-Class, GLC.
 * @param {string} token first space-delimited token, lowercased
 * @returns {string|null}
 */
function mercedesTrimToBase(token) {
  const t = String(token || '').toLowerCase();
  if (!t) return null;
  if (t.startsWith('cls')) return 'CLS';
  if (t.startsWith('cla')) return 'CLA';
  if (t.startsWith('gls')) return 'GLS';
  if (t.startsWith('glc')) return 'GLC';
  if (t.startsWith('gla')) return 'GLA';
  if (t.startsWith('sl')) return null;
  if (/^g\d/.test(t)) return 'G-Class';
  if (/^ml\d/.test(t) || t.startsWith('ml ')) return 'M-Class';
  if (/^c\d/.test(t)) return 'C-Class';
  if (/^e\d/.test(t)) return 'E-Class';
  if (/^s\d/.test(t)) return 'S-Class';
  return null;
}

/**
 * @param {string} make
 * @param {string} model user-submitted model or trim string
 * @returns {string|null} band table model name, or null if no alias
 */
function resolvePricingBandModelAlias(make, model) {
  const mk = makeKeyForAlias(make);
  const full = normSpace(model);
  if (!full) return null;
  const token = full.split(' ')[0];

  const table = TRIM_TO_BAND_MODEL[mk];
  if (table) {
    const fromMap = table[full] || table[token];
    if (fromMap) return fromMap;
  }

  if (mk === 'mercedes-benz') {
    const m = mercedesTrimToBase(token);
    if (m) return m;
  }

  return null;
}

module.exports = {
  resolvePricingBandModelAlias,
  makeKeyForAlias,
  normSpace,
  TRIM_TO_BAND_MODEL,
};
