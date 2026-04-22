/**
 * Grace to Grace — v1 pricing (server source of truth).
 *
 * Models (deterministic v1 — swap for live feeds later):
 * - Title status: seller-reported category multipliers.
 * - Regional scrap: ZIP-derived index (simulates local crush/export economics).
 * - Market proxy: class + ZIP3 + model-year blend (simulates wholesale/listing demand).
 */

const FACTOR_BY_ID = {
  runs: 1.0,
  minor_damage: 0.75,
  major_damage: 0.5,
  non_running: 0.35,
  flood_fire: 0.2,
};

const TITLE_FACTORS = {
  clean: 1,
  rebuilt: 0.82,
  salvage: 0.68,
  parts_only: 0.45,
  missing_unknown: 0.55,
  lien_reported: 0.72,
};

const CLASS_BASE_USD = {
  pickup: 4200,
  suv: 3800,
  van: 3400,
  default: 3200,
};

const SCRAP_FLOOR_BY_CLASS = {
  pickup: 480,
  suv: 420,
  van: 400,
  default: 350,
};

const CLASS_MARKET_DEMAND = {
  pickup: 1.045,
  suv: 1.025,
  van: 0.985,
  default: 1,
};

function classifyBody(bodyClass) {
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

/** Micro-variance by ZIP (legacy v0); kept as small location noise. */
function zipVariance(zip) {
  const z = String(zip || '').replace(/\D/g, '').slice(0, 5);
  if (z.length < 5) return 1;
  const n = parseInt(z.slice(0, 3), 10);
  if (Number.isNaN(n)) return 1;
  return 0.92 + ((n % 17) / 100) * 0.2;
}

function zip3(zip) {
  const z = String(zip || '').replace(/\D/g, '').slice(0, 5);
  if (z.length < 5) return null;
  const n = parseInt(z.slice(0, 3), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * v1 regional scrap index: 0.88–1.12 from ZIP3 (simulates yard/export density).
 */
function scrapRegionalIndex(zip) {
  const z3 = zip3(zip);
  if (z3 == null) return 1;
  const bucket = z3 % 23;
  return 0.88 + (bucket / 22) * 0.24;
}

/**
 * v1 market comps proxy: class demand × ZIP3 liquidity × model-year curve.
 */
function marketCompsProxy(year, vehicleClass, zip) {
  const z3 = zip3(zip);
  const demand = CLASS_MARKET_DEMAND[vehicleClass] ?? CLASS_MARKET_DEMAND.default;
  let liquidity = 1;
  if (z3 != null) {
    const h = (z3 * 7919 + 104729) % 1000;
    liquidity = 0.94 + (h / 1000) * 0.12;
  }
  const y = parseInt(year, 10);
  let yearCurve = 1;
  if (!Number.isNaN(y)) {
    const age = Math.max(0, new Date().getFullYear() - y);
    yearCurve = Math.max(0.88, 1 - age * 0.008);
  }
  const raw = demand * liquidity * yearCurve;
  return Math.max(0.82, Math.min(1.18, raw));
}

function deriveTitleFactor(titleStatus) {
  const k = String(titleStatus || 'clean').toLowerCase();
  return TITLE_FACTORS[k] ?? TITLE_FACTORS.clean;
}

function deriveConditionFactor(assessment) {
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

function computeOfferRangeInternal(input) {
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

  const scrapIdx = scrapRegionalIndex(input.zip);
  const marketPx = marketCompsProxy(input.year, cls, input.zip);
  const titleFx = deriveTitleFactor(input.titleStatus);

  base *= marketPx;
  base *= scrapIdx;
  base *= titleFx;

  const conditionFactor =
    input.assessment != null
      ? deriveConditionFactor(input.assessment)
      : FACTOR_BY_ID[input.conditionId] ?? 0.5;

  const adjusted = base * conditionFactor;
  let scrapFloor = SCRAP_FLOOR_BY_CLASS[cls] ?? SCRAP_FLOOR_BY_CLASS.default;
  scrapFloor *= scrapIdx;

  const low = Math.max(Math.round(scrapFloor), Math.round(adjusted * 0.72));
  const high = Math.max(low + 75, Math.round(adjusted * 1.12));

  return {
    low,
    high,
    meta: {
      vehicleClass: cls,
      conditionFactor,
      scrapFloor: Math.round(scrapFloor),
      baseBeforeCondition: Math.round(base),
      adjustedBeforeRound: adjusted,
      modelVersion: 'v1',
      marketCompsProxy: Number(marketPx.toFixed(4)),
      scrapRegionalIndex: Number(scrapIdx.toFixed(4)),
      titleFactor: Number(titleFx.toFixed(4)),
      titleStatus: String(input.titleStatus || 'clean'),
    },
  };
}

function validateEstimateBody(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid JSON body.');
  }
  const { year, make, model, zip, mileageMidpoint, assessment, titleStatus } = body;
  if (!String(year || '').trim() || !String(make || '').trim() || !String(model || '').trim()) {
    throw new Error('year, make, and model are required.');
  }
  const z = String(zip || '').replace(/\D/g, '');
  if (z.length < 5) {
    throw new Error('A 5-digit ZIP is required.');
  }
  if (!mileageMidpoint || String(mileageMidpoint).trim() === '') {
    throw new Error('mileageMidpoint (mileage bracket value) is required.');
  }
  if (assessment == null || typeof assessment !== 'object') {
    throw new Error('assessment object is required.');
  }
  return {
    year: String(year).trim(),
    make: String(make).trim(),
    model: String(model).trim(),
    bodyClass: body.bodyClass != null ? String(body.bodyClass) : '',
    zip: z.slice(0, 5),
    mileageMidpoint: String(mileageMidpoint).trim(),
    mileage: body.mileage,
    assessment,
    titleStatus: titleStatus != null ? String(titleStatus).trim() : 'clean',
    conditionId: body.conditionId,
  };
}

function computeGraceEstimate(body) {
  return computeOfferRangeInternal(validateEstimateBody(body));
}

module.exports = {
  computeGraceEstimate,
  validateEstimateBody,
  computeOfferRangeInternal,
  scrapRegionalIndex,
  marketCompsProxy,
  deriveTitleFactor,
  TITLE_FACTORS,
};
