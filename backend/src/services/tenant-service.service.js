const db = require('../db/connection');
const { normalizeBusinessName } = require('./bookingEmailParse.service');
const {
  normalizeFollowUpCampaigns,
  parseFollowUpCampaignsFromRow,
} = require('./service-followup-campaign.service');

const normalizeServiceName = (name) => normalizeBusinessName(name);

const mapServiceRow = (row) => ({
  id: row.id,
  name: row.name,
  aliases: Array.isArray(row.aliases) ? row.aliases : [],
  returnIntervalDays: row.return_interval_days == null || row.return_interval_days === ''
    ? null
    : Number(row.return_interval_days),
  rebookingEnabled: row.rebooking_enabled !== false,
  rebookMessage: row.rebook_message || '',
  rebookEmailSubject: row.rebook_email_subject || '',
  followUpCampaigns: parseFollowUpCampaignsFromRow(row),
  notes: row.notes || '',
  sortOrder: row.sort_order ?? 0,
});

const listServices = async (tenantId) => {
  const result = await db.query(
    `SELECT id, name, aliases, return_interval_days, rebooking_enabled,
            rebook_message, rebook_email_subject, follow_up_campaigns, notes, sort_order
     FROM tenant_services
     WHERE tenant_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [tenantId],
  );
  return { services: result.rows.map(mapServiceRow) };
};

const listServicesWithMeta = async (tenantId) => {
  const campaignsEnabled = await isServiceFollowUpCampaignsEnabled(tenantId);
  const { services } = await listServices(tenantId);
  return { services, serviceFollowupCampaignsEnabled: campaignsEnabled };
};

const isServiceFollowUpCampaignsEnabled = async (tenantId) => {
  const result = await db.query(
    'SELECT service_followup_campaigns_enabled FROM tenants WHERE id = $1',
    [tenantId],
  );
  return !!result.rows[0]?.service_followup_campaigns_enabled;
};

const normalizeServiceInput = (raw, { campaignsEnabled = false } = {}) => ({
  name: String(raw.name || '').trim(),
  aliases: Array.isArray(raw.aliases)
    ? raw.aliases.map((a) => String(a).trim()).filter(Boolean)
    : [],
  returnIntervalDays: raw.returnIntervalDays != null && raw.returnIntervalDays !== ''
    ? Number(raw.returnIntervalDays)
    : null,
  rebookingEnabled: raw.rebookingEnabled !== false,
  rebookMessage: typeof raw.rebookMessage === 'string' ? raw.rebookMessage : '',
  rebookEmailSubject: typeof raw.rebookEmailSubject === 'string' ? raw.rebookEmailSubject : '',
  followUpCampaigns: campaignsEnabled
    ? normalizeFollowUpCampaigns(raw.followUpCampaigns)
    : [],
  notes: typeof raw.notes === 'string' ? raw.notes : '',
  sortOrder: Number(raw.sortOrder) || 0,
});

const replaceServices = async (tenantId, services) => {
  if (!Array.isArray(services)) {
    throw Object.assign(new Error('services must be an array'), { statusCode: 400, isOperational: true });
  }

  const campaignsEnabled = await isServiceFollowUpCampaignsEnabled(tenantId);

  const normalized = services
    .map((s) => normalizeServiceInput(s, { campaignsEnabled }))
    .filter((s) => s.name);

  const names = new Set();
  for (const s of normalized) {
    const key = s.name.toLowerCase();
    if (names.has(key)) {
      throw Object.assign(new Error(`Duplicate service name: ${s.name}`), {
        statusCode: 400,
        isOperational: true,
      });
    }
    names.add(key);
  }

  await db.query('DELETE FROM tenant_services WHERE tenant_id = $1', [tenantId]);

  for (const s of normalized) {
    await db.query(
      `INSERT INTO tenant_services
        (tenant_id, name, aliases, return_interval_days, rebooking_enabled,
         rebook_message, rebook_email_subject, follow_up_campaigns, notes, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        tenantId,
        s.name,
        JSON.stringify(s.aliases),
        Number.isFinite(s.returnIntervalDays) ? s.returnIntervalDays : null,
        s.rebookingEnabled,
        s.rebookMessage || null,
        s.rebookEmailSubject || null,
        JSON.stringify(s.followUpCampaigns),
        s.notes || null,
        s.sortOrder,
      ],
    );
  }

  return listServicesWithMeta(tenantId);
};

function scoreServiceMatch(rawName, serviceRow) {
  const rawNorm = normalizeServiceName(rawName);
  if (!rawNorm) return 0;

  const candidates = [
    serviceRow.name,
    ...(Array.isArray(serviceRow.aliases) ? serviceRow.aliases : []),
  ];

  let best = 0;
  for (const candidate of candidates) {
    const candNorm = normalizeServiceName(candidate);
    if (!candNorm) continue;
    if (rawNorm === candNorm) best = Math.max(best, 100 + candNorm.length);
    else if (rawNorm.includes(candNorm) || candNorm.includes(rawNorm)) {
      best = Math.max(best, 50 + Math.min(rawNorm.length, candNorm.length));
    }
  }
  return best;
}

const matchService = async (tenantId, rawServiceName) => {
  if (!rawServiceName || !String(rawServiceName).trim()) return null;

  const result = await db.query(
    `SELECT id, name, aliases, return_interval_days, rebooking_enabled,
            rebook_message, rebook_email_subject, follow_up_campaigns, notes, sort_order
     FROM tenant_services
     WHERE tenant_id = $1`,
    [tenantId],
  );

  let best = null;
  let bestScore = 0;

  for (const row of result.rows) {
    const score = scoreServiceMatch(rawServiceName, row);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (!best || bestScore < 50) return null;
  return mapServiceRow(best);
};

const getServiceById = async (tenantId, serviceId) => {
  if (!serviceId) return null;

  const result = await db.query(
    `SELECT id, name, aliases, return_interval_days, rebooking_enabled,
            rebook_message, rebook_email_subject, follow_up_campaigns, notes, sort_order
     FROM tenant_services
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, serviceId],
  );

  return result.rows[0] ? mapServiceRow(result.rows[0]) : null;
};

const setAppointmentMatchedService = async (appointmentId, serviceId) => {
  await db.query(
    'UPDATE appointments SET matched_service_id = $2, updated_at = NOW() WHERE id = $1',
    [appointmentId, serviceId || null],
  );
};

const findTenantIdByUserEmail = async (email) => {
  const result = await db.query(
    `SELECT t.id, t.name
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [email.trim()],
  );
  return result.rows[0] || null;
};

module.exports = {
  listServices,
  listServicesWithMeta,
  replaceServices,
  matchService,
  getServiceById,
  setAppointmentMatchedService,
  findTenantIdByUserEmail,
  normalizeServiceName,
  mapServiceRow,
  isServiceFollowUpCampaignsEnabled,
};
