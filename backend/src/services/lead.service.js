const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');

/**
 * Normalize a phone number to E.164-ish format.
 * Strips everything except digits, prepends +1 if 10 digits (US).
 */
const normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.startsWith('+')) return phone.replace(/[^\d+]/g, '');
  return `+${digits}`;
};

/**
 * Create a new lead for a tenant.
 * This is the entry point for the entire conversion engine.
 *
 * Returns the created lead. The caller (route) is responsible
 * for emitting events (e.g. trigger instant SMS in Step 6).
 */
const createLead = async (tenantId, data) => {
  const { firstName, lastName, phone, email, source, metadata } = data;

  if (!phone) {
    throw Object.assign(new Error('Phone number is required'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const normalizedPhone = normalizePhone(phone);

  // Check for existing lead with same phone for this tenant
  const existing = await db.query(
    'SELECT id, status FROM leads WHERE tenant_id = $1 AND phone = $2',
    [tenantId, normalizedPhone],
  );

  if (existing.rows.length > 0) {
    // Lead already exists — update last_activity and return it
    const existingLead = existing.rows[0];
    await db.query(
      'UPDATE leads SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [existingLead.id],
    );

    const updated = await db.query('SELECT * FROM leads WHERE id = $1', [existingLead.id]);
    return { lead: formatLead(updated.rows[0]), isNew: false };
  }

  // Insert new lead
  const result = await db.query(
    `INSERT INTO leads (tenant_id, first_name, last_name, phone, email, source, metadata, status, last_activity_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', NOW())
     RETURNING *`,
    [
      tenantId,
      firstName || null,
      lastName || null,
      normalizedPhone,
      email || null,
      source || null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );

  const lead = result.rows[0];

  // Log consent (lead provided their info via form/ad/manual entry)
  await db.query(
    `INSERT INTO consent_log (tenant_id, lead_id, event_type, source)
     VALUES ($1, $2, 'consent_given', $3)`,
    [tenantId, lead.id, source || 'unknown'],
  );

  return { lead: formatLead(lead), isNew: true };
};

/**
 * List leads for a tenant with pagination, filtering, and sorting.
 */
const listLeads = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 25,
    status,
    source,
    search,
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = options;

  const offset = (page - 1) * limit;
  const params = [tenantId];
  const conditions = ['tenant_id = $1'];
  let paramIndex = 2;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status.toUpperCase());
    paramIndex++;
  }

  if (source) {
    conditions.push(`source = $${paramIndex}`);
    params.push(source);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const allowedSort = ['created_at', 'updated_at', 'status', 'first_name', 'qualification_score'];
  const safeSort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const where = conditions.join(' AND ');

  const [countResult, dataResult] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM leads WHERE ${where}`, params),
    db.query(
      `SELECT * FROM leads WHERE ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    leads: dataResult.rows.map(formatLead),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single lead by ID, scoped to the tenant.
 * Includes the conversation thread (messages).
 */
const getLeadById = async (tenantId, leadId) => {
  const leadResult = await db.query(
    'SELECT * FROM leads WHERE id = $1 AND tenant_id = $2',
    [leadId, tenantId],
  );

  if (leadResult.rows.length === 0) {
    throw Object.assign(new Error('Lead not found'), {
      statusCode: 404,
      isOperational: true,
    });
  }

  const messagesResult = await db.query(
    'SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at ASC',
    [leadId],
  );

  const followUpsResult = await db.query(
    'SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY step ASC',
    [leadId],
  );

  return {
    lead: formatLead(leadResult.rows[0]),
    messages: messagesResult.rows.map(formatMessage),
    followUps: followUpsResult.rows.map(formatFollowUp),
  };
};

/**
 * Look up a tenant by API key (for external webhook auth).
 */
const getTenantByApiKey = async (apiKey) => {
  const result = await db.query(
    'SELECT id, name, active FROM tenants WHERE api_key = $1',
    [apiKey],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// --- Formatters (snake_case DB → camelCase API) ---

const formatLead = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  email: row.email,
  source: row.source,
  status: row.status,
  qualificationScore: row.qualification_score,
  currentQuestionIndex: row.current_question_index,
  firstContactAt: row.first_contact_at,
  speedToLeadMs: row.speed_to_lead_ms,
  followupStep: row.followup_step,
  nextFollowupAt: row.next_followup_at,
  bookingLinkSent: row.booking_link_sent,
  bookedAt: row.booked_at,
  unsubscribed: row.unsubscribed,
  metadata: row.metadata,
  lastActivityAt: row.last_activity_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const formatMessage = (row) => ({
  id: row.id,
  direction: row.direction,
  body: row.body,
  fromNumber: row.from_number,
  toNumber: row.to_number,
  messageType: row.message_type,
  deliveryStatus: row.delivery_status,
  createdAt: row.created_at,
});

const formatFollowUp = (row) => ({
  id: row.id,
  step: row.step,
  messageBody: row.message_body,
  status: row.status,
  scheduledAt: row.scheduled_at,
  sentAt: row.sent_at,
});

module.exports = {
  createLead,
  listLeads,
  getLeadById,
  getTenantByApiKey,
  normalizePhone,
};
