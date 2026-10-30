const { parse } = require('csv-parse/sync');
const { normalizePhone } = require('./lead.service');

function normalizeCsvKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\*+$/, '')
    .replace(/\s*\(optional\)\s*$/i, '')
    .replace(/[\s_-]+/g, '');
}

function pickCsvField(row, ...aliases) {
  const wanted = new Set(aliases.map(normalizeCsvKey));
  for (const [key, value] of Object.entries(row || {})) {
    if (!wanted.has(normalizeCsvKey(key))) continue;
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function parseVisitDate(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = parsed.getUTCMonth() + 1;
    const d = parsed.getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return null;
}

function visitCheckedOutAtIso(visitDateYmd) {
  if (!visitDateYmd) return new Date().toISOString();
  return `${visitDateYmd}T17:00:00.000Z`;
}

/** Clinic export uses "LAST, FIRST MIDDLE" in one Patient column. */
function splitPatientName(raw) {
  const value = String(raw || '').trim();
  if (!value) return { firstName: null, lastName: null };
  const comma = value.indexOf(',');
  if (comma === -1) return { firstName: null, lastName: value };
  const lastName = value.slice(0, comma).trim() || null;
  const firstName = value.slice(comma + 1).trim() || null;
  return { firstName, lastName };
}

function checkoutExternalId(normalizedPhone, visitDateYmd) {
  const digits = String(normalizedPhone || '').replace(/\D/g, '');
  return `visit_list:${digits}:${visitDateYmd}`;
}

function appointmentExternalId(normalizedPhone, visitDateYmd) {
  return checkoutExternalId(normalizedPhone, visitDateYmd);
}

function parseVisitListCsv(buffer) {
  const content = buffer.toString('utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const rows = [];
  for (const row of records) {
    const phoneRaw = pickCsvField(
      row,
      'phone',
      'phone_number',
      'mobile',
      'cell',
      'primary phone',
      'home phone',
    );
    if (!phoneRaw) continue;

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phoneRaw);
    } catch {
      continue;
    }

    const visitRaw = pickCsvField(
      row,
      'visit_date',
      'visit date',
      'visitdate',
      'date_of_visit',
      'date of visit',
      'appointment_date',
      'appointment date',
      'last visit',
      'last_visit',
    );
    const visitDate = parseVisitDate(visitRaw);
    if (!visitDate) continue;

    let firstName = pickCsvField(row, 'first_name', 'firstname', 'first name', 'first') || null;
    let lastName = pickCsvField(row, 'last_name', 'lastname', 'last name', 'last') || null;
    if (!firstName && !lastName) {
      const split = splitPatientName(pickCsvField(row, 'patient', 'patient name'));
      firstName = split.firstName;
      lastName = split.lastName;
    }

    rows.push({
      firstName,
      lastName,
      phone: normalizedPhone,
      visitDate,
      checkedOutAt: visitCheckedOutAtIso(visitDate),
      externalId: checkoutExternalId(normalizedPhone, visitDate),
    });
  }

  return rows;
}

module.exports = {
  parseVisitListCsv,
  pickCsvField,
  parseVisitDate,
  splitPatientName,
  checkoutExternalId,
  appointmentExternalId,
};
