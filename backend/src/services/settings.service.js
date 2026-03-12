const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const { DEFAULT_SCHEDULE, DEFAULT_OUTREACH_WINDOW } = require('./followup.service');

const getSettings = async (tenantId) => {
  const result = await db.query(
    `SELECT id, name, industry, timezone, phone_number, booking_link,
            plan, api_key, followup_config, description, target_audience, tone,
            email_from_name, email_from_address, calendly_webhook_signing_key, created_at
     FROM tenants WHERE id = $1`,
    [tenantId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const t = result.rows[0];
  const config = t.followup_config || {};

  return {
    business: {
      name: t.name,
      industry: t.industry,
      timezone: t.timezone,
      phoneNumber: t.phone_number,
      bookingLink: t.booking_link,
      plan: t.plan,
      description: t.description,
      targetAudience: t.target_audience,
      tone: t.tone || 'friendly',
    },
    integration: {
      apiKey: t.api_key,
      calendlyWebhookSigningKey: t.calendly_webhook_signing_key || '',
      calendlyWebhookUrl: `${process.env.BASE_URL || 'https://api.clientforge.ai'}/api/v1/webhook/calendly/${tenantId}`,
      voiceWebhookUrl: `${process.env.BASE_URL || 'https://api.clientforge.ai'}/api/v1/voice/inbound`,
      smsInboundWebhookUrl: `${process.env.BASE_URL || 'https://api.clientforge.ai'}/api/v1/sms/inbound`,
    },
    email: {
      fromName: t.email_from_name || '',
      fromAddress: t.email_from_address || '',
    },
    followup: {
      schedule: config.schedule || DEFAULT_SCHEDULE,
      outreachWindow: config.outreach_window || DEFAULT_OUTREACH_WINDOW,
      missedCallMessage: config.missed_call_message || "Sorry we missed your call! How can we help? Reply to this message.",
    },
    createdAt: t.created_at,
  };
};

const updateSettings = async (tenantId, updates) => {
  const { business, followup } = updates;
  const sets = [];
  const params = [];
  let idx = 1;

  if (business) {
    if (business.name !== undefined) { sets.push(`name = $${idx++}`); params.push(business.name); }
    if (business.industry !== undefined) { sets.push(`industry = $${idx++}`); params.push(business.industry); }
    if (business.timezone !== undefined) { sets.push(`timezone = $${idx++}`); params.push(business.timezone); }
    if (business.phoneNumber !== undefined) { sets.push(`phone_number = $${idx++}`); params.push(business.phoneNumber); }
    if (business.bookingLink !== undefined) { sets.push(`booking_link = $${idx++}`); params.push(business.bookingLink); }
    if (business.description !== undefined) { sets.push(`description = $${idx++}`); params.push(business.description); }
    if (business.targetAudience !== undefined) { sets.push(`target_audience = $${idx++}`); params.push(business.targetAudience); }
    if (business.tone !== undefined) { sets.push(`tone = $${idx++}`); params.push(business.tone); }
  }

  if (updates.integration) {
    if (updates.integration.calendlyWebhookSigningKey !== undefined) {
      sets.push(`calendly_webhook_signing_key = $${idx++}`);
      params.push(updates.integration.calendlyWebhookSigningKey || null);
    }
  }

  if (updates.email) {
    if (updates.email.fromName !== undefined) { sets.push(`email_from_name = $${idx++}`); params.push(updates.email.fromName); }
    if (updates.email.fromAddress !== undefined) { sets.push(`email_from_address = $${idx++}`); params.push(updates.email.fromAddress); }
  }

  if (followup) {
    const currentResult = await db.query(
      'SELECT followup_config FROM tenants WHERE id = $1', [tenantId],
    );
    const currentConfig = currentResult.rows[0]?.followup_config || {};

    const newConfig = { ...currentConfig };
    if (followup.schedule) newConfig.schedule = followup.schedule;
    if (followup.outreachWindow) newConfig.outreach_window = followup.outreachWindow;
    if (followup.missedCallMessage !== undefined) newConfig.missed_call_message = followup.missedCallMessage;

    sets.push(`followup_config = $${idx++}`);
    params.push(JSON.stringify(newConfig));
  }

  if (sets.length === 0) {
    return getSettings(tenantId);
  }

  sets.push(`updated_at = NOW()`);
  params.push(tenantId);

  await db.query(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${idx}`,
    params,
  );

  return getSettings(tenantId);
};

const regenerateApiKey = async (tenantId) => {
  const newKey = `lf_${uuidv4().replace(/-/g, '')}`;

  await db.query(
    'UPDATE tenants SET api_key = $1, updated_at = NOW() WHERE id = $2',
    [newKey, tenantId],
  );

  return { apiKey: newKey };
};

module.exports = { getSettings, updateSettings, regenerateApiKey };
