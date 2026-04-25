const db = require('../db/connection');

const PREVIEW_MAX = 2000;

/**
 * SQL WHERE + params for campaign audience (shared by launch, preview, counts).
 * @param {string} channel 'sms' | 'email' | 'both'
 */
const buildAudienceWhere = (tenantId, audienceFilter, channel) => {
  const filter = audienceFilter && typeof audienceFilter === 'object' ? audienceFilter : {};
  const conditions = ['tenant_id = $1', 'unsubscribed = false'];
  const params = [tenantId];
  let idx = 2;

  if (filter.tag) {
    const tag = String(filter.tag).trim();
    if (tag) {
      conditions.push(`tags @> $${idx}::jsonb`);
      params.push(JSON.stringify([tag]));
      idx++;
    }
  }

  const ch = ['sms', 'email', 'both'].includes(channel) ? channel : 'sms';
  if (ch === 'email') {
    conditions.push('email IS NOT NULL');
  } else if (ch === 'sms') {
    conditions.push('phone IS NOT NULL');
  } else {
    conditions.push('phone IS NOT NULL');
    conditions.push('email IS NOT NULL');
  }
  return { whereSql: conditions.join(' AND '), params };
};

/**
 * @returns {Promise<{ total: number, limit: number, truncated: boolean, contacts: object[] }>}
 */
const previewAudience = async (tenantId, { audienceFilter, channel, limit = 500 } = {}) => {
  const max = Math.min(Math.max(1, parseInt(limit, 10) || 500), PREVIEW_MAX);
  const { whereSql, params } = buildAudienceWhere(tenantId, audienceFilter, channel);
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS n FROM contacts WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0].n;
  const dataRes = await db.query(
    `SELECT id, first_name, last_name, phone, email
     FROM contacts WHERE ${whereSql}
     ORDER BY LOWER(COALESCE(last_name, '')), LOWER(COALESCE(first_name, ''))
     LIMIT $${params.length + 1}`,
    [...params, max],
  );
  return {
    total,
    limit: max,
    truncated: total > max,
    contacts: dataRes.rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      email: r.email,
    })),
  };
};

const previewAudienceForCampaign = async (tenantId, campaignId, query = {}) => {
  const campaign = await getCampaign(tenantId, campaignId);
  return previewAudience(tenantId, {
    audienceFilter: campaign.audienceFilter,
    channel: campaign.channel || 'sms',
    limit: query.limit,
  });
};

const createCampaign = async (tenantId, data) => {
  const schedule = Array.isArray(data.schedule) && data.schedule.length > 0
    ? data.schedule
    : data.messageBody
      ? [{ step: 1, delay_days: 0, message: data.messageBody }]
      : [];

  const type = schedule.length > 1 ? 'sequence' : 'broadcast';
  const channel = ['sms', 'email', 'both'].includes(data.channel) ? data.channel : 'sms';

  const result = await db.query(
    `INSERT INTO campaigns (tenant_id, name, type, channel, message_body, schedule, audience_filter)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      data.name,
      type,
      channel,
      schedule[0]?.message || data.messageBody || '',
      JSON.stringify(schedule),
      JSON.stringify(data.audienceFilter || {}),
    ],
  );
  return formatCampaign(result.rows[0]);
};

const updateCampaign = async (tenantId, campaignId, data) => {
  const sets = [];
  const params = [tenantId, campaignId];
  let idx = 3;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.messageBody !== undefined) { sets.push(`message_body = $${idx++}`); params.push(data.messageBody); }
  if (data.channel !== undefined) { sets.push(`channel = $${idx++}`); params.push(data.channel); }
  if (data.schedule !== undefined) {
    sets.push(`schedule = $${idx++}`);
    params.push(JSON.stringify(data.schedule));
    const type = data.schedule.length > 1 ? 'sequence' : 'broadcast';
    sets.push(`type = $${idx++}`);
    params.push(type);
  }
  if (data.audienceFilter !== undefined) { sets.push(`audience_filter = $${idx++}`); params.push(JSON.stringify(data.audienceFilter)); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }

  if (sets.length === 0) return getCampaign(tenantId, campaignId);

  sets.push('updated_at = NOW()');

  const result = await db.query(
    `UPDATE campaigns SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    params,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Campaign not found'), { statusCode: 404, isOperational: true });
  }

  return formatCampaign(result.rows[0]);
};

const getCampaign = async (tenantId, campaignId) => {
  const result = await db.query(
    'SELECT * FROM campaigns WHERE tenant_id = $1 AND id = $2',
    [tenantId, campaignId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Campaign not found'), { statusCode: 404, isOperational: true });
  }

  const campaign = formatCampaign(result.rows[0]);

  const waveStats = await db.query(
    `SELECT step, channel,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
     FROM campaign_messages
     WHERE campaign_id = $1
     GROUP BY step, channel ORDER BY step, channel`,
    [campaignId],
  );

  campaign.waveStats = waveStats.rows;

  const linkAgg = await db.query(
    `SELECT
       COUNT(lc.id)::int AS link_total_clicks,
       COUNT(DISTINCT tl.contact_id) FILTER (WHERE tl.contact_id IS NOT NULL)::int AS link_unique_clicks
     FROM link_clicks lc
     JOIN tracked_links tl ON tl.id = lc.tracked_link_id
     JOIN campaign_messages cm ON cm.id = tl.campaign_message_id
     WHERE cm.campaign_id = $1`,
    [campaignId],
  );
  const la = linkAgg.rows[0] || {};
  campaign.linkTotalClicks = la.link_total_clicks ?? 0;
  campaign.linkUniqueClicks = la.link_unique_clicks ?? 0;

  return campaign;
};

const listCampaigns = async (tenantId, { page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;

  const [countRes, dataRes] = await Promise.all([
    db.query('SELECT COUNT(*)::int FROM campaigns WHERE tenant_id = $1', [tenantId]),
    db.query(
      `SELECT c.*,
         COALESCE(lc_agg.link_total_clicks, 0)::int AS link_total_clicks,
         COALESCE(lc_agg.link_unique_clicks, 0)::int AS link_unique_clicks
       FROM campaigns c
       LEFT JOIN (
         SELECT cm.campaign_id,
           COUNT(lc.id)::int AS link_total_clicks,
           COUNT(DISTINCT tl.contact_id) FILTER (WHERE tl.contact_id IS NOT NULL)::int AS link_unique_clicks
         FROM link_clicks lc
         JOIN tracked_links tl ON tl.id = lc.tracked_link_id
         JOIN campaign_messages cm ON cm.id = tl.campaign_message_id
         GROUP BY cm.campaign_id
       ) lc_agg ON lc_agg.campaign_id = c.id
       WHERE c.tenant_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    ),
  ]);

  return {
    campaigns: dataRes.rows.map(formatCampaign),
    pagination: {
      page, limit,
      total: countRes.rows[0].count,
      totalPages: Math.ceil(countRes.rows[0].count / limit),
    },
  };
};

const launchCampaign = async (tenantId, campaignId) => {
  const campaign = await getCampaign(tenantId, campaignId);

  if (campaign.status !== 'draft') {
    throw Object.assign(new Error('Only draft campaigns can be launched'), {
      statusCode: 400, isOperational: true,
    });
  }

  const schedule = campaign.schedule || [];
  if (schedule.length === 0) {
    throw Object.assign(new Error('Campaign has no messages in its sequence'), {
      statusCode: 400, isOperational: true,
    });
  }

  const channel = campaign.channel || 'sms';

  const { whereSql, params } = buildAudienceWhere(tenantId, campaign.audienceFilter, channel);

  const contacts = await db.query(
    `SELECT id, phone, email, first_name FROM contacts WHERE ${whereSql}`,
    params,
  );

  if (contacts.rows.length === 0) {
    throw Object.assign(new Error('No eligible contacts found for this campaign'), {
      statusCode: 400, isOperational: true,
    });
  }

  const tenantRes = await db.query(
    'SELECT name, booking_link, email_from_name, email_from_address FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantRes.rows[0];

  const now = new Date();
  const channels = channel === 'both' ? ['sms', 'email'] : [channel];

  const allRows = [];

  for (const contact of contacts.rows) {
    for (const wave of schedule) {
      const scheduledAt = new Date(now.getTime() + (wave.delay_days || 0) * 24 * 60 * 60 * 1000);
      const emailSubject = wave.email_subject || campaign.name;

      for (const ch of channels) {
        if (ch === 'sms' && !contact.phone) continue;
        if (ch === 'email' && !contact.email) continue;

        const messageText = ch === 'email' && wave.email_body
          ? wave.email_body
          : wave.message;

        const body = personalizeMessage(messageText, {
          firstName: contact.first_name || 'there',
          businessName: tenant.name,
          bookingLink: tenant.booking_link || '',
        });

        allRows.push({
          campaignId,
          tenantId,
          contactId: contact.id,
          body,
          step: wave.step,
          channel: ch,
          emailSubject: ch === 'email' ? personalizeMessage(emailSubject, {
            firstName: contact.first_name || 'there',
            businessName: tenant.name,
            bookingLink: tenant.booking_link || '',
          }) : null,
          scheduledAt,
        });
      }
    }
  }

  // Insert in chunks
  const CHUNK_SIZE = 400;
  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    const placeholders = [];
    const values = [];
    let pIdx = 1;

    for (const row of chunk) {
      placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, 'pending', $${pIdx + 7})`);
      values.push(row.campaignId, row.tenantId, row.contactId, row.body, row.step, row.channel, row.emailSubject, row.scheduledAt);
      pIdx += 8;
    }

    await db.query(
      `INSERT INTO campaign_messages (campaign_id, tenant_id, contact_id, message_body, step, channel, email_subject, status, scheduled_at)
       VALUES ${placeholders.join(', ')}`,
      values,
    );
  }

  await db.query(
    `UPDATE campaigns SET status = 'sending', total_recipients = $1, launched_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [contacts.rows.length, campaignId, tenantId],
  );

  return {
    recipientCount: contacts.rows.length,
    totalWaves: schedule.length,
    totalMessages: allRows.length,
    channel,
  };
};

const getCampaignStats = async (tenantId) => {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
       COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COALESCE(SUM(sent_count), 0)::int AS total_sent,
       COALESCE(SUM(reply_count), 0)::int AS total_replies
     FROM campaigns WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0];
};

const personalizeMessage = (template, vars) => {
  return template
    .replace(/\{firstName\}/gi, vars.firstName || 'there')
    .replace(/\{businessName\}/gi, vars.businessName || '')
    .replace(/\{bookingLink\}/gi, vars.bookingLink || '');
};

const formatCampaign = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  type: row.type,
  status: row.status,
  channel: row.channel || 'sms',
  messageBody: row.message_body,
  audienceFilter: row.audience_filter || {},
  schedule: row.schedule || [],
  totalRecipients: row.total_recipients,
  sentCount: row.sent_count,
  failedCount: row.failed_count,
  replyCount: row.reply_count,
  optoutCount: row.optout_count,
  launchedAt: row.launched_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  linkTotalClicks: row.link_total_clicks != null ? Number(row.link_total_clicks) : 0,
  linkUniqueClicks: row.link_unique_clicks != null ? Number(row.link_unique_clicks) : 0,
});

const getCampaignLinkClicks = async (tenantId, campaignId) => {
  const exists = await db.query(
    'SELECT 1 FROM campaigns WHERE tenant_id = $1 AND id = $2',
    [tenantId, campaignId],
  );
  if (exists.rows.length === 0) {
    throw Object.assign(new Error('Campaign not found'), { statusCode: 404, isOperational: true });
  }

  const result = await db.query(
    `SELECT
       c.id AS contact_id,
       c.first_name,
       c.last_name,
       c.phone,
       COUNT(lc.id)::int AS click_count,
       MIN(lc.clicked_at) AS first_clicked_at,
       MAX(lc.clicked_at) AS last_clicked_at
     FROM link_clicks lc
     JOIN tracked_links tl ON tl.id = lc.tracked_link_id
     JOIN campaign_messages cm ON cm.id = tl.campaign_message_id
     JOIN contacts c ON c.id = tl.contact_id
     WHERE cm.campaign_id = $1 AND cm.tenant_id = $2 AND tl.contact_id IS NOT NULL
     GROUP BY c.id, c.first_name, c.last_name, c.phone
     ORDER BY MAX(lc.clicked_at) DESC NULLS LAST`,
    [campaignId, tenantId],
  );

  return result.rows.map((r) => ({
    contactId: r.contact_id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    clickCount: r.click_count,
    firstClickedAt: r.first_clicked_at,
    lastClickedAt: r.last_clicked_at,
  }));
};

/**
 * Clone an existing campaign as a new draft. Copies name, channel, schedule, audience filter.
 * Does not copy campaign_messages (sent messages).
 */
const cloneCampaign = async (tenantId, sourceCampaignId) => {
  const source = await getCampaign(tenantId, sourceCampaignId);
  const newName = `${source.name} (Copy)`;
  return createCampaign(tenantId, {
    name: newName,
    channel: source.channel,
    schedule: source.schedule || [],
    audienceFilter: source.audienceFilter || {},
  });
};

/**
 * Create a template from campaign data.
 */
const createTemplate = async (tenantId, data) => {
  const result = await db.query(
    `INSERT INTO campaign_templates (tenant_id, name, channel, schedule, audience_filter)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      tenantId,
      data.name,
      ['sms', 'email', 'both'].includes(data.channel) ? data.channel : 'sms',
      JSON.stringify(data.schedule || []),
      JSON.stringify(data.audienceFilter || {}),
    ],
  );
  return formatTemplate(result.rows[0]);
};

/**
 * List templates for a tenant.
 */
const listTemplates = async (tenantId) => {
  const result = await db.query(
    'SELECT * FROM campaign_templates WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId],
  );
  return result.rows.map(formatTemplate);
};

/**
 * Get a single template.
 */
const getTemplate = async (tenantId, templateId) => {
  const result = await db.query(
    'SELECT * FROM campaign_templates WHERE tenant_id = $1 AND id = $2',
    [tenantId, templateId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Template not found'), { statusCode: 404, isOperational: true });
  }
  return formatTemplate(result.rows[0]);
};

/**
 * Create a campaign from a template.
 */
const createCampaignFromTemplate = async (tenantId, templateId, overrides = {}) => {
  const template = await getTemplate(tenantId, templateId);
  return createCampaign(tenantId, {
    name: overrides.name || template.name,
    channel: overrides.channel ?? template.channel,
    schedule: overrides.schedule ?? template.schedule,
    audienceFilter: overrides.audienceFilter ?? template.audienceFilter,
  });
};

const formatTemplate = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  channel: row.channel || 'sms',
  schedule: row.schedule || [],
  audienceFilter: row.audience_filter || {},
  createdAt: row.created_at,
});

module.exports = {
  createCampaign,
  updateCampaign,
  getCampaign,
  listCampaigns,
  launchCampaign,
  getCampaignStats,
  getCampaignLinkClicks,
  buildAudienceWhere,
  previewAudience,
  previewAudienceForCampaign,
  cloneCampaign,
  createTemplate,
  listTemplates,
  getTemplate,
  createCampaignFromTemplate,
};
