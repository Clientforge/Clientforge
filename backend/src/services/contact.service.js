const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');
const { parse } = require('csv-parse/sync');

/** Normalize CSV header for flexible matching (case, spaces, underscores). */
function normalizeCsvKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/** Pick first non-empty value from row using flexible column name aliases. */
function pickCsvField(row, ...aliases) {
  const wanted = new Set(aliases.map(normalizeCsvKey));
  for (const [key, value] of Object.entries(row || {})) {
    if (!wanted.has(normalizeCsvKey(key))) continue;
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * Parse a date-of-birth string into YYYY-MM-DD for Postgres DATE, or null if invalid.
 * Supports YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, and Excel-style floats (e.g. 2187907954.0 stripped).
 */
const parseDateOfBirth = (raw) => {
  if (raw == null || raw === '') return null;

  let value = String(raw).trim();
  if (!value) return null;

  // Excel sometimes exports dates as numbers — not handled here; callers should use text columns.
  if (/^\d+\.0+$/.test(value)) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    if (isValidDateParts(y, m, d)) return formatDateParts(y, m, d);
    return null;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (isValidDateParts(year, month, day)) return formatDateParts(year, month, day);
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
  }

  return null;
};

const isValidDateParts = (year, month, day) => {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
};

const formatDateParts = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Parse a calendar date into YYYY-MM-DD (shared by DOB and last-visit import). */
const parseContactDate = parseDateOfBirth;

const toLastVisitTimestamp = (dateStr) => {
  if (!dateStr) return null;
  return `${dateStr}T12:00:00.000Z`;
};

const importFromCSV = async (tenantId, csvBuffer, source = 'import') => {
  const content = csvBuffer.toString('utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  let imported = 0;
  let skipped = 0;
  let errors = [];

  for (const row of records) {
    const phone = pickCsvField(row, 'phone', 'phone_number', 'mobile', 'phonenumber');
    if (!phone) { skipped++; continue; }

    try {
      const normalizedPhone = normalizePhone(phone);
      const firstName = pickCsvField(row, 'first_name', 'firstname', 'first name', 'first');
      const lastName = pickCsvField(row, 'last_name', 'lastname', 'last name', 'last');
      const email = pickCsvField(row, 'email', 'e-mail');
      const dobRaw = pickCsvField(row, 'date_of_birth', 'dateofbirth', 'dob', 'birthday', 'birth date', 'birthdate');
      const dateOfBirth = parseDateOfBirth(dobRaw);
      const lastVisitRaw = pickCsvField(
        row,
        'last_visit',
        'lastvisit',
        'last_visit_at',
        'last visit',
        'appointment_date',
        'appointment date',
        'last appointment',
      );
      const lastVisitDate = parseContactDate(lastVisitRaw);
      const lastVisitAt = toLastVisitTimestamp(lastVisitDate);
      const tags = pickCsvField(row, 'tags', 'tag');
      const notes = pickCsvField(row, 'notes', 'note');

      const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

      await db.query(
        `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, date_of_birth, last_visit_at, tags, source, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, phone) DO UPDATE SET
           first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), contacts.first_name),
           last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), contacts.last_name),
           email = COALESCE(NULLIF(EXCLUDED.email, ''), contacts.email),
           date_of_birth = COALESCE(EXCLUDED.date_of_birth, contacts.date_of_birth),
           last_visit_at = CASE
             WHEN EXCLUDED.last_visit_at IS NOT NULL THEN GREATEST(
               COALESCE(contacts.last_visit_at, EXCLUDED.last_visit_at),
               EXCLUDED.last_visit_at
             )
             ELSE contacts.last_visit_at
           END,
           tags = CASE
             WHEN EXCLUDED.tags IS NOT NULL AND EXCLUDED.tags != '[]'::jsonb THEN EXCLUDED.tags
             ELSE contacts.tags
           END,
           notes = COALESCE(NULLIF(EXCLUDED.notes, ''), contacts.notes),
           updated_at = NOW()`,
        [
          tenantId,
          firstName || null,
          lastName || null,
          normalizedPhone,
          email || null,
          dateOfBirth,
          lastVisitAt,
          JSON.stringify(tagArray),
          source,
          notes || null,
        ],
      );
      imported++;
    } catch (err) {
      errors.push({ phone, error: err.message });
      skipped++;
    }
  }

  return { imported, skipped, total: records.length, errors: errors.slice(0, 10) };
};

const listContacts = async (tenantId, {
  page = 1,
  limit = 25,
  search,
  tag,
  lastVisit,
  sortBy,
}) => {
  const offset = (page - 1) * limit;
  const params = [tenantId];
  const conditions = ['tenant_id = $1'];
  let idx = 2;

  if (search) {
    conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  if (tag) {
    conditions.push(`tags @> $${idx}::jsonb`);
    params.push(JSON.stringify([tag]));
    idx++;
  }

  if (lastVisit === 'none') {
    conditions.push('last_visit_at IS NULL');
  } else if (lastVisit === '30d') {
    conditions.push(`last_visit_at >= NOW() - INTERVAL '30 days'`);
  } else if (lastVisit === '90d') {
    conditions.push(`last_visit_at >= NOW() - INTERVAL '90 days'`);
  } else if (lastVisit === '365d') {
    conditions.push(`last_visit_at >= NOW() - INTERVAL '365 days'`);
  } else if (lastVisit === 'older90d') {
    conditions.push(`last_visit_at < NOW() - INTERVAL '90 days'`);
  }

  const where = conditions.join(' AND ');
  const orderBy = sortBy === 'last_visit_at' || lastVisit
    ? 'last_visit_at DESC NULLS LAST, created_at DESC'
    : 'created_at DESC';

  const [countRes, dataRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int FROM contacts WHERE ${where}`, params),
    db.query(
      `SELECT * FROM contacts WHERE ${where} ORDER BY ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
  ]);

  return {
    contacts: dataRes.rows.map(formatContact),
    pagination: {
      page, limit,
      total: countRes.rows[0].count,
      totalPages: Math.ceil(countRes.rows[0].count / limit),
    },
  };
};

const createContact = async (tenantId, data) => {
  const phone = normalizePhone(data.phone);
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const dateOfBirth = data.dateOfBirth !== undefined
    ? parseDateOfBirth(data.dateOfBirth)
    : null;

  const result = await db.query(
    `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, date_of_birth, tags, source, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tenantId,
      data.firstName || null,
      data.lastName || null,
      phone,
      data.email || null,
      dateOfBirth,
      JSON.stringify(tags),
      data.source || 'manual',
      data.notes || null,
    ],
  );

  return formatContact(result.rows[0]);
};

const getContact = async (tenantId, contactId) => {
  const result = await db.query(
    'SELECT * FROM contacts WHERE tenant_id = $1 AND id = $2',
    [tenantId, contactId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
  }
  return formatContact(result.rows[0]);
};

/**
 * @param {object} data - Partial: firstName, lastName, email, dateOfBirth, tags (array), notes. Phone is not changed.
 */
const updateContact = async (tenantId, contactId, data) => {
  if (!data || typeof data !== 'object') {
    throw Object.assign(new Error('Invalid body'), { statusCode: 400, isOperational: true });
  }

  const existing = await db.query(
    'SELECT * FROM contacts WHERE tenant_id = $1 AND id = $2',
    [tenantId, contactId],
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
  }
  const row = existing.rows[0];

  const firstName = data.firstName !== undefined ? (data.firstName || null) : row.first_name;
  const lastName = data.lastName !== undefined ? (data.lastName || null) : row.last_name;
  const email = data.email !== undefined ? (data.email || null) : row.email;
  const notes = data.notes !== undefined ? (data.notes || null) : row.notes;

  let dateOfBirth = row.date_of_birth;
  if (data.dateOfBirth !== undefined) {
    dateOfBirth = data.dateOfBirth === null || data.dateOfBirth === ''
      ? null
      : parseDateOfBirth(data.dateOfBirth);
  }

  let tagsJson;
  if (data.tags !== undefined) {
    const arr = Array.isArray(data.tags) ? data.tags : [];
    tagsJson = JSON.stringify(arr);
  } else {
    const existingTags = Array.isArray(row.tags) ? row.tags : [];
    tagsJson = JSON.stringify(existingTags);
  }

  const result = await db.query(
    `UPDATE contacts SET
       first_name = $1,
       last_name = $2,
       email = $3,
       date_of_birth = $4,
       tags = $5::jsonb,
       notes = $6,
       updated_at = NOW()
     WHERE tenant_id = $7 AND id = $8
     RETURNING *`,
    [firstName, lastName, email, dateOfBirth, tagsJson, notes, tenantId, contactId],
  );

  return formatContact(result.rows[0]);
};

const deleteContact = async (tenantId, contactId) => {
  const result = await db.query(
    'DELETE FROM contacts WHERE tenant_id = $1 AND id = $2 RETURNING id',
    [tenantId, contactId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
  }

  return { deleted: true, id: result.rows[0].id };
};

const bulkDeleteContacts = async (tenantId, ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw Object.assign(new Error('Select at least one contact to delete'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw Object.assign(new Error('Select at least one contact to delete'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  if (uniqueIds.length > 100) {
    throw Object.assign(new Error('Delete at most 100 contacts at a time'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const result = await db.query(
    'DELETE FROM contacts WHERE tenant_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
    [tenantId, uniqueIds],
  );

  return { deletedCount: result.rows.length, ids: result.rows.map((r) => r.id) };
};

const getContactStats = async (tenantId) => {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE unsubscribed = false)::int AS active,
       COUNT(*) FILTER (WHERE unsubscribed = true)::int AS unsubscribed,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS added_this_week
     FROM contacts WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0];
};

const formatContact = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  email: row.email,
  dateOfBirth: row.date_of_birth
    ? (row.date_of_birth instanceof Date
      ? row.date_of_birth.toISOString().slice(0, 10)
      : String(row.date_of_birth).slice(0, 10))
    : null,
  tags: row.tags || [],
  source: row.source,
  notes: row.notes,
  unsubscribed: row.unsubscribed,
  lastVisitAt: row.last_visit_at,
  createdAt: row.created_at,
});

/** Distinct tag strings across all contacts (for pickers, filters). */
const listContactTags = async (tenantId) => {
  const result = await db.query(
    `SELECT DISTINCT t AS tag
     FROM contacts, LATERAL jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS t
     WHERE tenant_id = $1
     ORDER BY 1`,
    [tenantId],
  );
  return (result.rows || []).map((r) => r.tag).filter((t) => t && String(t).length > 0);
};

module.exports = {
  parseDateOfBirth,
  parseContactDate,
  importFromCSV,
  listContacts,
  createContact,
  getContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  getContactStats,
  listContactTags,
};
