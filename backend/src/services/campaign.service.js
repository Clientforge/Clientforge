const db = require('../db/connection');
const { normalizeLastVisitPreset, appendLastVisitCondition } = require('../utils/lastVisitFilter');
const { getTenantTimezone } = require('../utils/tenantTimezone');
const {
  computeWaveScheduledAt,
  normalizeSchedule,
  DEFAULT_SEND_TIME,
} = require('../utils/campaignSchedule');

const PREVIEW_MAX = 2000;

const AUDIENCE_ORDER_BY = `LOWER(COALESCE(last_name, '')), LOWER(COALESCE(first_name, ''))`;

/**
 * Normalize batch launch/preview options.
 * @returns {{ mode: string, limit: number|null, offset: number, rangeStart?: number, rangeEnd?: number }}
 */
const parseBatchOptions = (options = {}) => {
  if (options.limit != null || options.offset != null) {
    const limit = options.limit != null ? Math.max(1, parseInt(options.limit, 10) || 1) : null;
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);
    return { mode: limit == null ? 'all' : 'first', limit, offset };
  }

  const mode = options.batchMode || 'all';
  if (mode === 'first') {
    const limit = Math.max(1, parseInt(options.batchSize, 10) || 100);
    return { mode: 'first', limit, offset: 0 };
  }
  if (mode === 'range') {
    const rangeStart = Math.max(1, parseInt(options.rangeStart, 10) || 1);
    const rangeEnd = Math.max(rangeStart, parseInt(options.rangeEnd, 10) || rangeStart);
    return {
      mode: 'range',
      limit: rangeEnd - rangeStart + 1,
      offset: rangeStart - 1,
      rangeStart,
      rangeEnd,
    };
  }
  return { mode: 'all', limit: null, offset: 0 };
};

/**
 * Normalize tag list from audience_filter (supports legacy { tag } or { tags: [] }).
 */
const normalizeAudienceTags = (filter) => {
  if (!filter || typeof filter !== 'object') return [];
  if (Array.isArray(filter.tags)) {
    return [...new Set(filter.tags.map((t) => String(t).trim()).filter(Boolean))];
  }
  if (filter.tag) {
    const single = String(filter.tag).trim();
    return single ? [single] : [];
  }
  return [];
};

const normalizeAudienceFilter = (raw) => {
  const out = {};
  const tags = normalizeAudienceTags(raw);
  if (tags.length > 0) out.tags = tags;
  const lastVisit = normalizeLastVisitPreset(raw?.lastVisit);
  if (lastVisit) out.lastVisit = lastVisit;
  return out;
};

/**
 * SQL WHERE + params for campaign audience (shared by launch, preview, counts).
 * Multiple tags match ANY (OR).
 * @param {string} channel 'sms' | 'email' | 'both'
 */
const buildAudienceWhere = (tenantId, audienceFilter, channel) => {
  const filter = audienceFilter && typeof audienceFilter === 'object' ? audienceFilter : {};
  const conditions = ['tenant_id = $1', 'unsubscribed = false'];
  const params = [tenantId];
  let idx = 2;

  const tags = normalizeAudienceTags(filter);
  if (tags.length === 1) {
    conditions.push(`tags @> $${idx}::jsonb`);
    params.push(JSON.stringify([tags[0]]));
    idx++;
  } else if (tags.length > 1) {
    conditions.push(`tags ?| $${idx}::text[]`);
    params.push(tags);
    idx++;
  }

  appendLastVisitCondition(conditions, filter.lastVisit);

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

const countLaunchedContacts = async (campaignId) => {
  const result = await db.query(
    `SELECT COUNT(DISTINCT contact_id)::int AS n FROM campaign_messages WHERE campaign_id = $1`,
    [campaignId],
  );
  return result.rows[0]?.n ?? 0;
};

const mapContactRow = (r) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  phone: r.phone,
  email: r.email,
});

/**
 * @returns {Promise<{ total: number, limit: number, truncated: boolean, contacts: object[], alreadyLaunched?: number, remaining?: number, batchStart?: number, batchEnd?: number, batchSize?: number }>}
 */
const previewAudience = async (tenantId, options = {}) => {
  const {
    audienceFilter,
    channel,
    limit: previewLimit = 500,
    campaignId,
    batchMode,
    batchSize,
    rangeStart,
    rangeEnd,
    offset: rawOffset,
    limit: rawLimit,
  } = options;

  const batch = parseBatchOptions({
    batchMode,
    batchSize,
    rangeStart,
    rangeEnd,
    offset: rawOffset,
    limit: rawLimit,
  });

  const { whereSql, params } = buildAudienceWhere(tenantId, audienceFilter, channel);
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS n FROM contacts WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0].n;

  let alreadyLaunched = 0;
  if (campaignId) {
    alreadyLaunched = await countLaunchedContacts(campaignId);
  }

  const listLimit = batch.mode === 'all' ? null : batch.limit;
  const listOffset = batch.mode === 'all' ? 0 : batch.offset;

  let batchStart = null;
  let batchEnd = null;
  if (batch.mode !== 'all' && total > 0) {
    batchStart = Math.min(listOffset + 1, total);
    batchEnd = Math.min(listOffset + (listLimit || 0), total);
    if (batchStart > total) {
      batchStart = null;
      batchEnd = null;
    }
  }

  const previewMax = Math.min(Math.max(1, parseInt(previewLimit, 10) || 500), PREVIEW_MAX);
  const queryLimit = batch.mode === 'all' ? previewMax : Math.min(listLimit || previewMax, previewMax);
  const queryOffset = batch.mode === 'all' ? 0 : listOffset;

  const listParams = [...params];
  let listSql = `SELECT id, first_name, last_name, phone, email
     FROM contacts WHERE ${whereSql}
     ORDER BY ${AUDIENCE_ORDER_BY}`;
  if (queryLimit != null) {
    listParams.push(queryLimit);
    listSql += ` LIMIT $${listParams.length}`;
  }
  if (queryOffset > 0) {
    listParams.push(queryOffset);
    listSql += ` OFFSET $${listParams.length}`;
  }

  const dataRes = await db.query(listSql, listParams);
  const batchTotal = batch.mode === 'all' ? total : Math.max(0, Math.min(listLimit || 0, total - listOffset));

  let launchableCount = batch.mode === 'all' ? total : batchTotal;
  if (campaignId) {
    if (batch.mode === 'all') {
      launchableCount = Math.max(0, total - alreadyLaunched);
    } else {
      const launchable = await fetchAudienceForLaunch(tenantId, {
        audienceFilter,
        channel,
        batch,
        campaignId,
      });
      launchableCount = launchable.length;
    }
  }

  return {
    total,
    alreadyLaunched,
    remaining: Math.max(0, total - alreadyLaunched),
    batchMode: batch.mode,
    batchSize: batch.mode === 'all' ? total : listLimit,
    batchStart,
    batchEnd,
    batchContactCount: batch.mode === 'all' ? total : batchTotal,
    launchableCount,
    limit: queryLimit,
    truncated: batch.mode === 'all' ? total > previewMax : batchTotal > dataRes.rows.length,
    contacts: dataRes.rows.map(mapContactRow),
  };
};

const previewAudienceForCampaign = async (tenantId, campaignId, query = {}) => {
  const campaign = await getCampaign(tenantId, campaignId);
  return previewAudience(tenantId, {
    audienceFilter: campaign.audienceFilter,
    channel: campaign.channel || 'sms',
    campaignId,
    limit: query.limit,
    batchMode: query.batchMode,
    batchSize: query.batchSize,
    rangeStart: query.rangeStart,
    rangeEnd: query.rangeEnd,
  });
};

const fetchAudienceForLaunch = async (tenantId, { audienceFilter, channel, batch, campaignId }) => {
  const { whereSql, params } = buildAudienceWhere(tenantId, audienceFilter, channel);
  const listParams = [...params];
  let idx = listParams.length + 1;

  let listSql = `SELECT id, phone, email, first_name
     FROM contacts WHERE ${whereSql}
     ORDER BY ${AUDIENCE_ORDER_BY}`;

  if (batch.mode !== 'all' && batch.limit != null) {
    listParams.push(batch.limit);
    listSql += ` LIMIT $${idx++}`;
    if (batch.offset > 0) {
      listParams.push(batch.offset);
      listSql += ` OFFSET $${idx++}`;
    }
  }

  const result = await db.query(listSql, listParams);

  if (!campaignId) {
    return result.rows;
  }

  const launched = await db.query(
    `SELECT DISTINCT contact_id FROM campaign_messages WHERE campaign_id = $1`,
    [campaignId],
  );
  const launchedIds = new Set(launched.rows.map((r) => r.contact_id));
  return result.rows.filter((row) => !launchedIds.has(row.id));
};

const createCampaign = async (tenantId, data) => {
  const rawSchedule = Array.isArray(data.schedule) && data.schedule.length > 0
    ? data.schedule
    : data.messageBody
      ? [{ step: 1, delay_days: 0, message: data.messageBody }]
      : [];

  const schedule = normalizeSchedule(rawSchedule).map((wave, i) => ({
    ...wave,
    step: wave.step ?? i + 1,
    send_time: wave.send_time || DEFAULT_SEND_TIME,
  }));

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
      JSON.stringify(normalizeAudienceFilter(data.audienceFilter)),
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
    const normalized = normalizeSchedule(data.schedule).map((wave, i) => ({
      ...wave,
      step: wave.step ?? i + 1,
      send_time: wave.send_time || DEFAULT_SEND_TIME,
    }));
    sets.push(`schedule = $${idx++}`);
    params.push(JSON.stringify(normalized));
    const type = normalized.length > 1 ? 'sequence' : 'broadcast';
    sets.push(`type = $${idx++}`);
    params.push(type);
  }
  if (data.audienceFilter !== undefined) {
    sets.push(`audience_filter = $${idx++}`);
    params.push(JSON.stringify(normalizeAudienceFilter(data.audienceFilter)));
  }
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

const launchCampaign = async (tenantId, campaignId, launchOptions = {}) => {
  const campaign = await getCampaign(tenantId, campaignId);

  const launchableStatuses = ['draft', 'sending', 'completed'];
  if (!launchableStatuses.includes(campaign.status)) {
    throw Object.assign(new Error('This campaign cannot be launched in its current state'), {
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
  const batch = parseBatchOptions(launchOptions);

  const contactRows = await fetchAudienceForLaunch(tenantId, {
    audienceFilter: campaign.audienceFilter,
    channel,
    batch,
    campaignId,
  });

  if (contactRows.length === 0) {
    throw Object.assign(new Error('No eligible contacts found for this batch (audience may be empty or already launched)'), {
      statusCode: 400, isOperational: true,
    });
  }

  const tenantRes = await db.query(
    'SELECT name, booking_link, email_from_name, email_from_address, timezone FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantRes.rows[0];
  const timezone = tenant?.timezone || await getTenantTimezone(tenantId);

  const now = new Date();
  const channels = channel === 'both' ? ['sms', 'email'] : [channel];

  const allRows = [];

  for (const contact of contactRows) {
    for (const wave of schedule) {
      const scheduledAt = computeWaveScheduledAt({
        launchedAt: now,
        delayDays: wave.delay_days,
        sendTime: wave.send_time,
        timezone,
      });
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

  const isFirstLaunch = campaign.status === 'draft';
  await db.query(
    `UPDATE campaigns SET
       status = 'sending',
       total_recipients = total_recipients + $1,
       launched_at = COALESCE(launched_at, NOW()),
       completed_at = NULL,
       updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [contactRows.length, campaignId, tenantId],
  );

  const alreadyLaunched = await countLaunchedContacts(campaignId);

  return {
    recipientCount: contactRows.length,
    batchMode: batch.mode,
    batchStart: batch.mode === 'all' ? 1 : batch.offset + 1,
    batchEnd: batch.mode === 'all' ? alreadyLaunched : batch.offset + contactRows.length,
    totalLaunched: alreadyLaunched,
    totalWaves: schedule.length,
    totalMessages: allRows.length,
    channel,
    isFirstLaunch,
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
  audienceFilter: normalizeAudienceFilter(row.audience_filter),
  schedule: normalizeSchedule(row.schedule || []).map((wave, i) => ({
    ...wave,
    step: wave.step ?? i + 1,
  })),
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
      JSON.stringify(normalizeAudienceFilter(data.audienceFilter)),
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
  audienceFilter: normalizeAudienceFilter(row.audience_filter),
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
  normalizeAudienceTags,
  normalizeAudienceFilter,
  parseBatchOptions,
  previewAudience,
  previewAudienceForCampaign,
  cloneCampaign,
  createTemplate,
  listTemplates,
  getTemplate,
  createCampaignFromTemplate,
};
