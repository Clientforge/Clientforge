const db = require('../db/connection');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');
const { renderTemplate } = require('./appointment-automation.service');

const DEFAULT_MESSAGE =
  'Happy Birthday {firstName}! From all of us at {businessName}, we hope you have an amazing day. Book a treat: {bookingLink}';

const buildDefaultConfig = () => ({
  enabled: false,
  message: DEFAULT_MESSAGE,
  send_hour: 9,
});

const normalizeConfig = (raw) => {
  const base = buildDefaultConfig();
  if (!raw || typeof raw !== 'object') return base;

  const sendHour = Number(raw.send_hour ?? raw.sendHour);
  return {
    enabled: raw.enabled === true,
    message: typeof raw.message === 'string' && raw.message.trim()
      ? raw.message.trim()
      : base.message,
    send_hour: Number.isFinite(sendHour) && sendHour >= 0 && sendHour <= 23
      ? Math.floor(sendHour)
      : base.send_hour,
  };
};

const toApiConfig = (config) => ({
  enabled: config.enabled,
  message: config.message,
  sendHour: config.send_hour,
});

const fromApiConfig = (api) => {
  if (!api || typeof api !== 'object') return null;
  return normalizeConfig({
    enabled: api.enabled,
    message: api.message,
    send_hour: api.sendHour ?? api.send_hour,
  });
};

const getLocalDateTimeParts = (timezone) => {
  const tz = timezone || 'America/New_York';
  const now = new Date();

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
  };
};

const getConfigForTenant = async (tenantId) => {
  const result = await db.query(
    `SELECT birthday_campaign_config, name, timezone, phone_number, booking_link, review_link
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }
  return { tenant: result.rows[0], config: normalizeConfig(result.rows[0].birthday_campaign_config) };
};

const getBirthdayCampaign = async (tenantId) => {
  const { config } = await getConfigForTenant(tenantId);
  return toApiConfig(config);
};

const updateBirthdayCampaign = async (tenantId, updates) => {
  const normalized = fromApiConfig(updates);
  if (!normalized) {
    throw Object.assign(new Error('Invalid birthday campaign config'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  await db.query(
    'UPDATE tenants SET birthday_campaign_config = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(normalized), tenantId],
  );

  return getBirthdayCampaign(tenantId);
};

const buildTemplateVars = ({ tenant, contact }) => ({
  firstName: contact.first_name || 'there',
  lastName: contact.last_name || '',
  businessName: tenant.name || 'us',
  bookingLink: tenant.booking_link || '',
  reviewLink: tenant.review_link || tenant.booking_link || '',
});

const findBirthdayContacts = async (tenantId, month, day, calendarYear) => {
  const result = await db.query(
    `SELECT c.*
     FROM contacts c
     WHERE c.tenant_id = $1
       AND c.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM c.date_of_birth) = $2
       AND EXTRACT(DAY FROM c.date_of_birth) = $3
       AND c.unsubscribed = false
       AND NOT EXISTS (
         SELECT 1 FROM birthday_campaign_sends s
         WHERE s.tenant_id = c.tenant_id
           AND s.contact_id = c.id
           AND s.calendar_year = $4
       )
     ORDER BY c.created_at ASC`,
    [tenantId, month, day, calendarYear],
  );
  return result.rows;
};

const claimDailyRun = async (tenantId, runDate) => {
  const result = await db.query(
    `INSERT INTO birthday_campaign_daily_runs (tenant_id, run_date)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id, run_date) DO NOTHING
     RETURNING id`,
    [tenantId, runDate],
  );
  return result.rows.length > 0;
};

const sendBirthdayMessage = async ({ tenant, contact, config }) => {
  const canSend = await compliance.canSendToContact(contact.id);
  if (!canSend) return { skipped: true, reason: 'compliance' };

  const vars = buildTemplateVars({ tenant, contact });
  const body = renderTemplate(config.message, vars);
  if (!body || !contact.phone) return { skipped: true, reason: 'missing_body_or_phone' };

  const message = await smsService.sendSms({
    tenantId: tenant.id,
    leadId: null,
    contactId: contact.id,
    to: contact.phone,
    from: tenant.phone_number || undefined,
    body,
    messageType: 'birthday_campaign',
  });

  if (message.delivery_status === 'blocked') {
    return { skipped: true, reason: 'blocked' };
  }

  const local = getLocalDateTimeParts(tenant.timezone);
  await db.query(
    `INSERT INTO birthday_campaign_sends (tenant_id, contact_id, calendar_year, message_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, contact_id, calendar_year) DO NOTHING`,
    [tenant.id, contact.id, local.year, message.id],
  );

  return { sent: true, messageId: message.id };
};

const processBirthdayCampaignForTenant = async (tenantRow) => {
  const config = normalizeConfig(tenantRow.birthday_campaign_config);
  if (!config.enabled) return { sent: 0, skipped: true, reason: 'disabled' };

  const local = getLocalDateTimeParts(tenantRow.timezone);
  if (local.hour !== config.send_hour) {
    return { sent: 0, skipped: true, reason: 'not_send_hour' };
  }

  const claimed = await claimDailyRun(tenantRow.id, local.dateKey);
  if (!claimed) return { sent: 0, skipped: true, reason: 'already_ran_today' };

  const contacts = await findBirthdayContacts(
    tenantRow.id,
    local.month,
    local.day,
    local.year,
  );

  if (contacts.length === 0) {
    console.log(`[BIRTHDAY] Tenant ${tenantRow.id}: no birthdays on ${local.dateKey}`);
    return { sent: 0, contacts: 0 };
  }

  console.log(`[BIRTHDAY] Tenant ${tenantRow.id}: sending to ${contacts.length} contact(s)`);

  let sent = 0;
  for (const contact of contacts) {
    try {
      const result = await sendBirthdayMessage({
        tenant: tenantRow,
        contact,
        config,
      });
      if (result.sent) sent += 1;
    } catch (err) {
      console.error(`[BIRTHDAY] Failed for contact ${contact.id}:`, err.message);
    }
  }

  return { sent, contacts: contacts.length };
};

const processAllBirthdayCampaigns = async () => {
  const result = await db.query(
    `SELECT id, name, timezone, phone_number, booking_link, review_link, birthday_campaign_config
     FROM tenants
     WHERE birthday_campaign_config IS NOT NULL
       AND (birthday_campaign_config->>'enabled')::boolean = true`,
  );

  let totalSent = 0;
  for (const tenant of result.rows) {
    try {
      const outcome = await processBirthdayCampaignForTenant(tenant);
      if (outcome.sent) totalSent += outcome.sent;
    } catch (err) {
      console.error(`[BIRTHDAY] Tenant ${tenant.id} error:`, err.message);
    }
  }

  return totalSent;
};

module.exports = {
  buildDefaultConfig,
  normalizeConfig,
  getBirthdayCampaign,
  updateBirthdayCampaign,
  getLocalDateTimeParts,
  findBirthdayContacts,
  processBirthdayCampaignForTenant,
  processAllBirthdayCampaigns,
  buildTemplateVars,
};
