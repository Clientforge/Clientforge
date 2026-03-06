const db = require('../db/connection');

/**
 * Get key stats for a tenant's dashboard.
 */
const getStats = async (tenantId) => {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total_leads,
       COUNT(*) FILTER (WHERE status = 'QUALIFIED')::int AS qualified,
       COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
       COUNT(*) FILTER (WHERE status = 'UNRESPONSIVE')::int AS unresponsive,
       COUNT(*) FILTER (WHERE next_followup_at IS NOT NULL AND status NOT IN ('BOOKED','UNRESPONSIVE'))::int AS in_followup,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS new_today,
       COUNT(*) FILTER (WHERE booking_link_sent = true)::int AS booking_links_sent
     FROM leads
     WHERE tenant_id = $1`,
    [tenantId],
  );

  const stats = result.rows[0];
  const conversionRate = stats.total_leads > 0
    ? Math.round((stats.booked / stats.total_leads) * 100)
    : 0;

  return { ...stats, conversionRate };
};

/**
 * Get conversion funnel counts per status.
 */
const getFunnel = async (tenantId) => {
  const result = await db.query(
    `SELECT status, COUNT(*)::int AS count
     FROM leads
     WHERE tenant_id = $1
     GROUP BY status
     ORDER BY CASE status
       WHEN 'NEW' THEN 1
       WHEN 'CONTACTED' THEN 2
       WHEN 'QUALIFYING' THEN 3
       WHEN 'QUALIFIED' THEN 4
       WHEN 'BOOKED' THEN 5
       WHEN 'UNRESPONSIVE' THEN 6
     END`,
    [tenantId],
  );

  const totalResult = await db.query(
    'SELECT COUNT(*)::int AS total FROM leads WHERE tenant_id = $1',
    [tenantId],
  );
  const total = totalResult.rows[0].total;

  const funnel = result.rows.map((row) => ({
    status: row.status,
    count: row.count,
    percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
  }));

  return { total, funnel };
};

/**
 * Get speed-to-lead metrics.
 */
const getSpeedToLead = async (tenantId) => {
  const result = await db.query(
    `SELECT
       ROUND(AVG(speed_to_lead_ms))::int AS avg_ms,
       MIN(speed_to_lead_ms)::int AS min_ms,
       MAX(speed_to_lead_ms)::int AS max_ms,
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed_to_lead_ms))::int AS median_ms,
       COUNT(*)::int AS sample_size
     FROM leads
     WHERE tenant_id = $1 AND speed_to_lead_ms IS NOT NULL`,
    [tenantId],
  );

  return result.rows[0];
};

/**
 * Get recent leads (last 10).
 */
const getRecentLeads = async (tenantId, limit = 10) => {
  const result = await db.query(
    `SELECT id, first_name, last_name, phone, email, source, status,
            qualification_score, speed_to_lead_ms, booking_link_sent, created_at
     FROM leads
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, limit],
  );

  return result.rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    email: r.email,
    source: r.source,
    status: r.status,
    qualificationScore: r.qualification_score,
    speedToLeadMs: r.speed_to_lead_ms,
    bookingLinkSent: r.booking_link_sent,
    createdAt: r.created_at,
  }));
};

module.exports = { getStats, getFunnel, getSpeedToLead, getRecentLeads };
