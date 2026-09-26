const TITLE_SHORT = {
  clean: 'Clean title',
  rebuilt: 'Rebuilt title',
  salvage: 'Salvage title',
  parts_only: 'Parts-only title',
  missing_unknown: 'Title missing/unknown',
  lien_reported: 'Lien reported',
};

const START_SHORT = {
  starts_drives: 'Starts & drives',
  starts_not_drives: "Starts but won't drive",
  does_not_start: "Won't start",
};

const TIRE_SHORT = {
  all_ok: 'OK',
  flat: 'Flat',
  missing: 'Missing',
};

const PANEL_KEYS = ['front', 'rear', 'left', 'right', 'engine', 'flood', 'fire'];
const PANEL_LABELS = {
  front: 'Front',
  rear: 'Rear',
  left: 'Left side',
  right: 'Right side',
  engine: 'Engine',
  flood: 'Flood',
  fire: 'Fire',
};

function formatMileageShort(mileage) {
  if (!mileage) return '—';
  const n = parseInt(String(mileage).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return String(mileage).trim() || '—';
  if (n >= 1000) {
    const k = Math.round(n / 1000);
    return `${k}K mi`;
  }
  return `${n.toLocaleString('en-US')} mi`;
}

function formatPhoneDisplay(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '—';
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    d = d.slice(1);
  } else if (d.length > 11) {
    d = d.slice(-10);
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

function formatMajorDamage(exterior, bodyDamage) {
  const bd = bodyDamage && typeof bodyDamage === 'object' ? bodyDamage : {};
  const flagged = PANEL_KEYS.filter((k) => bd[k] === 'some').map((k) => PANEL_LABELS[k]);
  if (bd.glass === 'some') flagged.push('Glass/lights');
  if (bd.airbag === 'some') flagged.push('Airbag');
  if (exterior === 'rust_or_damage') flagged.push('Exterior rust/damage');
  if (exterior === 'no_major' && flagged.length === 0) return 'No major damage';
  if (flagged.length === 0) return 'Damage reported';
  return `Major damage: ${flagged.join(', ')}`;
}

function pickShort(map, key, fallback = '—') {
  if (!key) return fallback;
  return map[key] || fallback;
}

/**
 * Compact team SMS when estimate is generated (no VIN, no dollar range).
 */
function buildCompactEstimateTeamSms(v) {
  const name = v.customerName || '—';
  const ymm = [v.year, v.make, v.model].filter(Boolean).join(' ') || '—';
  const mi = formatMileageShort(v.mileage);
  const line1 = `${name} | ${ymm} | ${mi}`;

  const title = pickShort(TITLE_SHORT, v.titleStatus, v.titleStatus || '—');
  const start = pickShort(START_SHORT, v.startDrive, v.startDrive || '—');
  const keys =
    v.key === 'yes' ? 'Yes' : v.key === 'no' ? 'No' : v.key ? String(v.key) : '—';
  const tires = pickShort(TIRE_SHORT, v.tireCondition, v.tireCondition || '—');
  const damage = formatMajorDamage(v.exterior, v.bodyDamage);
  const line2 = `${title} | ${start} | Keys: ${keys} | Tires: ${tires} | ${damage}`;

  const lines = ['New Estimate', line1, line2, `ZIP: ${v.zip || '—'}`];
  lines.push(`Phone: ${formatPhoneDisplay(v.phone)}`);
  lines.push(`Email: ${v.email || '—'}`);
  if (v.manualReviewRequired) {
    lines.push('Note: Team review required');
  }
  return lines.join('\n').slice(0, 1500);
}

function sanitizeBodyDamage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const k of [...PANEL_KEYS, 'glass', 'airbag']) {
    if (raw[k] === 'none' || raw[k] === 'some') out[k] = raw[k];
  }
  return Object.keys(out).length ? out : null;
}

module.exports = {
  buildCompactEstimateTeamSms,
  formatMileageShort,
  formatPhoneDisplay,
  sanitizeBodyDamage,
};
