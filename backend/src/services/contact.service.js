const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');
const { parse } = require('csv-parse/sync');

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
    const phone = row.phone || row.Phone || row.phone_number || row.mobile || row.Mobile || '';
    if (!phone) { skipped++; continue; }

    try {
      const normalizedPhone = normalizePhone(phone);
      const firstName = row.first_name || row.firstName || row.First || row['First Name'] || '';
      const lastName = row.last_name || row.lastName || row.Last || row['Last Name'] || '';
      const email = row.email || row.Email || '';
      const tags = row.tags || row.Tags || '';
      const notes = row.notes || row.Notes || '';

      const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

      await db.query(
        `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, tags, source, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tenant_id, phone) DO UPDATE SET
           first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), contacts.first_name),
           last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), contacts.last_name),
           email = COALESCE(NULLIF(EXCLUDED.email, ''), contacts.email),
           updated_at = NOW()`,
        [tenantId, firstName || null, lastName || null, normalizedPhone, email || null, JSON.stringify(tagArray), source, notes || null],
      );
      imported++;
    } catch (err) {
      errors.push({ phone, error: err.message });
      skipped++;
    }
  }

  return { imported, skipped, total: records.length, errors: errors.slice(0, 10) };
};

const listContacts = async (tenantId, { page = 1, limit = 25, search, tag }) => {
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

  const where = conditions.join(' AND ');

  const [countRes, dataRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int FROM contacts WHERE ${where}`, params),
    db.query(
      `SELECT * FROM contacts WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
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

  const result = await db.query(
    `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, tags, source, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, data.firstName || null, data.lastName || null, phone, data.email || null, JSON.stringify(tags), data.source || 'manual', data.notes || null],
  );

  return formatContact(result.rows[0]);
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

module.exports = { importFromCSV, listContacts, createContact, getContactStats, listContactTags };
