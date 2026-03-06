const db = require('../db/connection');

const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const getPlatformStats = async () => {
  const [tenants, leads, messages, followups] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE active = true AND id != $1)::int AS active,
        COUNT(*) FILTER (WHERE active = false)::int AS inactive,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND id != $1)::int AS new_this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND id != $1)::int AS new_this_month
      FROM tenants WHERE id != $1
    `, [PLATFORM_TENANT_ID]),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_week,
        COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
        COUNT(*) FILTER (WHERE status = 'QUALIFIED')::int AS qualified,
        COUNT(*) FILTER (WHERE status = 'UNRESPONSIVE')::int AS unresponsive,
        ROUND(AVG(speed_to_lead_ms) FILTER (WHERE speed_to_lead_ms IS NOT NULL))::int AS avg_speed_to_lead_ms
      FROM leads
    `),
    db.query(`SELECT COUNT(*)::int AS total FROM messages`),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent
      FROM follow_ups
    `),
  ]);

  const t = tenants.rows[0];
  const l = leads.rows[0];
  const m = messages.rows[0];
  const f = followups.rows[0];

  return {
    tenants: { total: t.total, active: t.active, inactive: t.inactive, newThisWeek: t.new_this_week, newThisMonth: t.new_this_month },
    leads: { total: l.total, today: l.today, thisWeek: l.this_week, booked: l.booked, qualified: l.qualified, unresponsive: l.unresponsive, avgSpeedToLeadMs: l.avg_speed_to_lead_ms },
    messages: { total: m.total },
    followups: { pending: f.pending, sent: f.sent },
    planBreakdown: await getPlanBreakdown(),
  };
};

const getPlanBreakdown = async () => {
  const result = await db.query(`
    SELECT plan, COUNT(*)::int AS count
    FROM tenants WHERE id != $1
    GROUP BY plan ORDER BY count DESC
  `, [PLATFORM_TENANT_ID]);
  return result.rows;
};

const getTenantList = async ({ page = 1, limit = 20, search, sortBy = 'created_at', sortOrder = 'DESC' }) => {
  const offset = (page - 1) * limit;
  const params = [PLATFORM_TENANT_ID];
  const conditions = ['t.id != $1'];
  let idx = 2;

  if (search) {
    conditions.push(`(t.name ILIKE $${idx} OR t.industry ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const allowed = ['created_at', 'name', 'plan', 'lead_count'];
  const safeSort = allowed.includes(sortBy) ? sortBy : 'created_at';
  const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const where = conditions.join(' AND ');

  const sortCol = safeSort === 'lead_count' ? 'lead_count' : `t.${safeSort}`;

  const [countRes, dataRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int FROM tenants t WHERE ${where}`, params),
    db.query(`
      SELECT t.id, t.name, t.industry, t.timezone, t.plan, t.active, t.created_at,
             COUNT(l.id)::int AS lead_count,
             MAX(l.created_at) AS last_lead_at
      FROM tenants t
      LEFT JOIN leads l ON l.tenant_id = t.id
      WHERE ${where}
      GROUP BY t.id
      ORDER BY ${sortCol} ${safeOrder}
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]),
  ]);

  return {
    tenants: dataRes.rows.map(formatTenantRow),
    pagination: {
      page, limit,
      total: countRes.rows[0].count,
      totalPages: Math.ceil(countRes.rows[0].count / limit),
    },
  };
};

const getTenantDetail = async (tenantId) => {
  const [tenantRes, statsRes, usersRes, recentLeadsRes] = await Promise.all([
    db.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]),
    db.query(`
      SELECT
        COUNT(*)::int AS total_leads,
        COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
        COUNT(*) FILTER (WHERE status = 'QUALIFIED')::int AS qualified,
        COUNT(*) FILTER (WHERE status = 'CONTACTED')::int AS contacted,
        COUNT(*) FILTER (WHERE status = 'NEW')::int AS new_leads,
        COUNT(*) FILTER (WHERE status = 'UNRESPONSIVE')::int AS unresponsive,
        COUNT(*) FILTER (WHERE booking_link_sent = true)::int AS booking_links_sent,
        ROUND(AVG(speed_to_lead_ms) FILTER (WHERE speed_to_lead_ms IS NOT NULL))::int AS avg_speed_ms,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS leads_this_week
      FROM leads WHERE tenant_id = $1
    `, [tenantId]),
    db.query(`SELECT id, email, first_name, last_name, role, active, last_login_at, created_at FROM users WHERE tenant_id = $1`, [tenantId]),
    db.query(`
      SELECT id, first_name, last_name, phone, status, source, created_at
      FROM leads WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10
    `, [tenantId]),
  ]);

  if (tenantRes.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const t = tenantRes.rows[0];
  const s = statsRes.rows[0];

  const [msgCount, fuCount] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM messages WHERE tenant_id = $1`, [tenantId]),
    db.query(`SELECT COUNT(*) FILTER (WHERE status='pending')::int AS pending, COUNT(*) FILTER (WHERE status='sent')::int AS sent FROM follow_ups WHERE tenant_id = $1`, [tenantId]),
  ]);

  return {
    tenant: {
      id: t.id, name: t.name, industry: t.industry, timezone: t.timezone,
      plan: t.plan, active: t.active, phoneNumber: t.phone_number,
      bookingLink: t.booking_link, apiKey: t.api_key, createdAt: t.created_at,
    },
    stats: {
      totalLeads: s.total_leads, booked: s.booked, qualified: s.qualified,
      contacted: s.contacted, newLeads: s.new_leads, unresponsive: s.unresponsive,
      bookingLinksSent: s.booking_links_sent, avgSpeedMs: s.avg_speed_ms,
      leadsThisWeek: s.leads_this_week,
      totalMessages: msgCount.rows[0].total,
      pendingFollowups: fuCount.rows[0].pending,
      sentFollowups: fuCount.rows[0].sent,
    },
    users: usersRes.rows.map((u) => ({
      id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name,
      role: u.role, active: u.active, lastLoginAt: u.last_login_at, createdAt: u.created_at,
    })),
    recentLeads: recentLeadsRes.rows.map((r) => ({
      id: r.id, firstName: r.first_name, lastName: r.last_name,
      phone: r.phone, status: r.status, source: r.source, createdAt: r.created_at,
    })),
  };
};

const formatTenantRow = (row) => ({
  id: row.id, name: row.name, industry: row.industry, timezone: row.timezone,
  plan: row.plan, active: row.active, createdAt: row.created_at,
  leadCount: row.lead_count, lastLeadAt: row.last_lead_at,
});

module.exports = { getPlatformStats, getTenantList, getTenantDetail };
