import { VIN_DECODE_BASE } from './constants';

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function isValidVinFormat(vin) {
  return VIN_RE.test(String(vin || '').trim());
}

export function normalizeVin(vin) {
  return String(vin || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
}

export function getVinDecodeUrl(vin) {
  const v = normalizeVin(vin);
  if (!isValidVinFormat(v)) return null;
  const base = VIN_DECODE_BASE.replace(/\/$/, '');
  if (base) {
    return `${base}/vin-decode/${encodeURIComponent(v)}`;
  }
  return `/api/v1/public/vin-decode/${encodeURIComponent(v)}`;
}

function clean(v) {
  const s = v == null ? '' : String(v).trim();
  return s && s !== 'Not Applicable' && s !== '0' ? s : '';
}

export function mapVpicResult(row) {
  if (!row || typeof row !== 'object') return null;
  const year = clean(row.ModelYear);
  const make = clean(row.Make);
  const model = clean(row.Model);
  const trim = clean(row.Trim) || clean(row.Series);
  const bodyClass = clean(row.BodyClass);
  const disp = clean(row.DisplacementL);
  const engParts = [];
  if (disp) engParts.push(`${disp}L`);
  const engModel = clean(row.EngineModel);
  if (engModel) engParts.push(engModel);
  const cyl = clean(row.EngineCylinders);
  if (!engParts.length && cyl) engParts.push(`${cyl} cyl`);
  const engine = engParts.length ? engParts.join(' · ') : undefined;

  if (!year && !make && !model) return null;

  return {
    year,
    make,
    model,
    trim: trim || undefined,
    bodyClass: bodyClass || undefined,
    engine: engine || undefined,
    raw: row,
  };
}

export async function decodeVin(vin) {
  const url = getVinDecodeUrl(vin);
  if (!url) {
    throw new Error('Invalid VIN.');
  }
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Decode failed (${res.status})`);
  }
  const data = await res.json();
  const row = data?.Results?.[0];
  const mapped = mapVpicResult(row);
  if (!mapped) {
    throw new Error('Could not read vehicle data from VIN response.');
  }
  return mapped;
}
