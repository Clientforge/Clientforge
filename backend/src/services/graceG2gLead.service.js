const db = require('../db/connection');
const config = require('../config');
const { createLead, normalizePhone } = require('./lead.service');
const { sendSms } = require('./sms.service');
const { sendEmail } = require('./email.service');
const tenantPhoneService = require('./tenant-phone.service');

const PLATFORM_TENANT_DEFAULT = '00000000-0000-0000-0000-000000000001';
const G2G_SOURCE = 'grace_to_grace';
const DEFAULT_ESTIMATE_SMS_COOLDOWN_HOURS = 6;

class G2gLeadError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const tenantIdForG2g = () =>
  process.env.G2G_SELL_INTENT_TENANT_ID?.trim() || PLATFORM_TENANT_DEFAULT;

function trimStr(s, max) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function mergeMetadata(existing, patch) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return { ...base, ...patch };
}

async function resolveFromNumber(tenantId) {
  const r = await db.query('SELECT phone_number, sms_provider FROM tenants WHERE id = $1', [tenantId]);
  const row = r.rows[0];
  return tenantPhoneService.resolveEffectiveSmsFrom(row?.phone_number, row?.sms_provider).from;
}

function resolveNotifyPhone(envKey, fallbackEnvKey) {
  const primary = process.env[envKey];
  if (primary && String(primary).trim()) return normalizePhone(String(primary).trim());
  const fallback = process.env[fallbackEnvKey];
  if (fallback && String(fallback).trim()) return normalizePhone(String(fallback).trim());
  return null;
}

async function sendInternalSms({ tenantId, leadId, to, body, messageType }) {
  const from = await resolveFromNumber(tenantId);
  await sendSms({
    tenantId,
    leadId: leadId || null,
    contactId: null,
    to,
    from,
    body: body.slice(0, 1500),
    messageType,
  });
}

async function sendInternalEmail({ tenantId, to, subject, body }) {
  if (!to) return;
  await sendEmail({
    tenantId,
    to,
    fromName: 'Grace to Grace',
    subject,
    body,
  });
}

function validateContactBody(body) {
  if (!body || typeof body !== 'object') {
    throw new G2gLeadError('Invalid request body.');
  }
  const firstName = trimStr(body.firstName, 80);
  if (firstName.length < 2) {
    throw new G2gLeadError('Enter your first name (at least 2 characters).');
  }
  const phoneRaw = trimStr(body.phone, 32);
  if (!phoneRaw) {
    throw new G2gLeadError('Phone number is required.');
  }
  let phone;
  try {
    phone = normalizePhone(phoneRaw);
  } catch {
    throw new G2gLeadError('Enter a valid phone number.');
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    throw new G2gLeadError('Enter a valid phone number.');
  }
  const email = trimStr(body.email, 254).toLowerCase();
  if (!email || !isValidEmail(email)) {
    throw new G2gLeadError('Enter a valid email address.');
  }
  const sessionId =
    body.sessionId != null ? trimStr(body.sessionId, 80) || null : null;
  const zip = trimStr(body.zip, 10).replace(/\D/g, '').slice(0, 5);
  if (zip.length !== 5) {
    throw new G2gLeadError('Enter a valid 5-digit ZIP code.');
  }
  const city = trimStr(body.city, 80);
  const state = trimStr(body.state, 2).toUpperCase();
  if (!city) {
    throw new G2gLeadError('City is required. Enter your ZIP code to look it up.');
  }
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new G2gLeadError('State is required. Enter your ZIP code to look it up.');
  }
  return { firstName, phone, email, sessionId, zip, city, state };
}

/**
 * Create or update a G2G lead when contact info is submitted (before vehicle step).
 */
const startG2gLead = async (body) => {
  const v = validateContactBody(body);
  const tenantId = tenantIdForG2g();
  const metadata = {
    funnelStage: 'ESTIMATE_STARTED',
    sessionId: v.sessionId,
    zip: v.zip,
    city: v.city,
    state: v.state,
  };

  const existing = await db.query(
    'SELECT * FROM leads WHERE tenant_id = $1 AND phone = $2',
    [tenantId, v.phone],
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const mergedMeta = mergeMetadata(row.metadata, metadata);
    await db.query(
      `UPDATE leads
       SET first_name = $2,
           email = $3,
           source = $4,
           metadata = $5::jsonb,
           last_activity_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, v.firstName, v.email, G2G_SOURCE, JSON.stringify(mergedMeta)],
    );
    const updated = await db.query('SELECT * FROM leads WHERE id = $1', [row.id]);
    return { leadId: updated.rows[0].id, isNew: false };
  }

  const { lead } = await createLead(tenantId, {
    firstName: v.firstName,
    phone: v.phone,
    email: v.email,
    source: G2G_SOURCE,
    metadata,
  });
  return { leadId: lead.id, isNew: true };
};

function buildEstimateSmsBody(v) {
  const vinPart = v.vin || '—';
  const miPart = v.mileage || '—';
  const condPart = v.conditionLabel || '—';
  let estPart = v.estimateDisplay || '—';
  if (
    estPart === '—'
    && v.estimateLow != null
    && v.estimateHigh != null
    && v.estimateLow !== v.estimateHigh
  ) {
    estPart = `$${v.estimateLow.toLocaleString()}–$${v.estimateHigh.toLocaleString()}`;
  } else if (estPart === '—' && v.estimateLow != null && Number.isFinite(v.estimateLow)) {
    estPart = `$${v.estimateLow.toLocaleString()}`;
  }
  return (
    `[G2G ESTIMATE] New estimate inquiry\n` +
    `Name: ${v.customerName}\n` +
    `Phone: ${v.phone}\n` +
    `Email: ${v.email}\n` +
    `Vehicle: ${v.year} ${v.make} ${v.model}\n` +
    `VIN: ${vinPart}\n` +
    `Mileage: ${miPart}\n` +
    `Condition: ${condPart}\n` +
    `ZIP: ${v.zip}\n` +
    `Estimate: ${estPart}`
  );
}

function buildEstimateEmailBody(v) {
  return buildEstimateSmsBody(v);
}

/** Contact fields for estimate notify — zip required; city/state optional. */
function validateEstimateNotifyContact(body) {
  if (!body || typeof body !== 'object') {
    throw new G2gLeadError('Invalid request body.');
  }
  const firstName = trimStr(body.firstName, 80);
  if (firstName.length < 2) {
    throw new G2gLeadError('Enter your first name (at least 2 characters).');
  }
  const phoneRaw = trimStr(body.phone, 32);
  if (!phoneRaw) {
    throw new G2gLeadError('Phone number is required.');
  }
  let phone;
  try {
    phone = normalizePhone(phoneRaw);
  } catch {
    throw new G2gLeadError('Enter a valid phone number.');
  }
  if (phone.replace(/\D/g, '').length < 10) {
    throw new G2gLeadError('Enter a valid phone number.');
  }
  const email = trimStr(body.email, 254).toLowerCase();
  if (!email || !isValidEmail(email)) {
    throw new G2gLeadError('Enter a valid email address.');
  }
  const sessionId =
    body.sessionId != null ? trimStr(body.sessionId, 80) || null : null;
  const zip = trimStr(body.zip, 10).replace(/\D/g, '').slice(0, 5);
  if (zip.length !== 5) {
    throw new G2gLeadError('ZIP code is required.');
  }
  const city = trimStr(body.city, 80) || null;
  const state = trimStr(body.state, 2).toUpperCase() || null;
  return { firstName, phone, email, sessionId, zip, city, state };
}

function validateEstimateNotifyBody(body) {
  const contact = validateEstimateNotifyContact(body);
  const year = trimStr(body.year, 4);
  const make = trimStr(body.make, 80);
  const model = trimStr(body.model, 80);
  const vehicleZip = trimStr(body.zip, 10).replace(/\D/g, '').slice(0, 5);
  if (!year || !make || !model) {
    throw new G2gLeadError('Vehicle year, make, and model are required.');
  }
  if (vehicleZip.length < 5) {
    throw new G2gLeadError('ZIP code is required.');
  }
  const vin = trimStr(body.vin, 17).toUpperCase().replace(/\s/g, '') || null;
  const mileage = trimStr(body.mileage, 32) || null;
  const conditionLabel = trimStr(body.conditionLabel, 500) || null;
  let estimateLow = null;
  let estimateHigh = null;
  if (body.estimateLow != null && body.estimateHigh != null) {
    const lo = Number(body.estimateLow);
    const hi = Number(body.estimateHigh);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      estimateLow = Math.round(lo);
      estimateHigh = Math.round(hi);
    }
  }
  const estimateDisplay = trimStr(body.estimateDisplay, 64) || null;
  const leadId = trimStr(body.leadId, 64) || null;
  return {
    ...contact,
    customerName: contact.firstName,
    year,
    make,
    model,
    zip: vehicleZip,
    vin,
    mileage,
    conditionLabel,
    estimateLow,
    estimateHigh,
    estimateDisplay,
    leadId: leadId || null,
    vehicle: { year, make, model, zip: vehicleZip, vin, mileage, conditionLabel },
    estimate: { low: estimateLow, high: estimateHigh, display: estimateDisplay },
  };
}

function estimateTeamSmsCooldownMs() {
  const hours = Number(process.env.G2G_ESTIMATE_SMS_COOLDOWN_HOURS);
  if (Number.isFinite(hours) && hours > 0) {
    return Math.round(hours * 60 * 60 * 1000);
  }
  return DEFAULT_ESTIMATE_SMS_COOLDOWN_HOURS * 60 * 60 * 1000;
}

async function fetchLeadRow(tenantId, leadId, phone) {
  if (leadId) {
    const byId = await db.query(
      'SELECT id, metadata FROM leads WHERE id = $1 AND tenant_id = $2',
      [leadId, tenantId],
    );
    if (byId.rows.length > 0) return byId.rows[0];
  }
  const byPhone = await db.query(
    'SELECT id, metadata FROM leads WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone],
  );
  return byPhone.rows[0] || null;
}

/** Max one team estimate SMS per customer phone within the cooldown window. */
function shouldSendEstimateTeamSms(metadata) {
  if (!metadata || typeof metadata !== 'object') return true;
  const last = metadata.lastEstimateTeamSmsAt || metadata.estimateNotifiedAt;
  if (!last) return true;
  const lastMs = new Date(last).getTime();
  if (!Number.isFinite(lastMs)) return true;
  return Date.now() - lastMs >= estimateTeamSmsCooldownMs();
}

async function updateLeadAfterEstimate(tenantId, leadId, phone, patch) {
  if (leadId) {
    const r = await db.query(
      'SELECT metadata FROM leads WHERE id = $1 AND tenant_id = $2',
      [leadId, tenantId],
    );
    if (r.rows.length > 0) {
      const merged = mergeMetadata(r.rows[0].metadata, patch);
      await db.query(
        `UPDATE leads SET metadata = $3::jsonb, last_activity_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [leadId, tenantId, JSON.stringify(merged)],
      );
      return leadId;
    }
  }
  const byPhone = await db.query(
    'SELECT id, metadata FROM leads WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone],
  );
  if (byPhone.rows.length === 0) return null;
  const row = byPhone.rows[0];
  const merged = mergeMetadata(row.metadata, patch);
  await db.query(
    `UPDATE leads SET metadata = $2::jsonb, last_activity_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [row.id, JSON.stringify(merged)],
  );
  return row.id;
}

/**
 * After estimate is generated — notify team and mark lead ESTIMATE_COMPLETED.
 */
const notifyG2gEstimateLead = async (body) => {
  const to = resolveNotifyPhone('G2G_ESTIMATE_NOTIFY_PHONE', 'G2G_SELL_NOTIFY_PHONE');
  if (!to || to.replace(/\D/g, '').length < 10) {
    throw new G2gLeadError(
      'Estimate notifications are not configured. Set G2G_ESTIMATE_NOTIFY_PHONE or G2G_SELL_NOTIFY_PHONE.',
      503,
    );
  }

  const v = validateEstimateNotifyBody(body);
  const tenantId = tenantIdForG2g();
  const existingLead = await fetchLeadRow(tenantId, v.leadId, v.phone);
  const sendTeamSms = shouldSendEstimateTeamSms(existingLead?.metadata);

  const nowIso = new Date().toISOString();
  const metadataPatch = {
    funnelStage: 'ESTIMATE_COMPLETED',
    sessionId: v.sessionId,
    zip: v.zip,
    city: v.city,
    state: v.state,
    vehicle: v.vehicle,
    estimate: v.estimate,
    lastEstimateAt: nowIso,
  };
  if (sendTeamSms) {
    metadataPatch.lastEstimateTeamSmsAt = nowIso;
    metadataPatch.estimateNotifiedAt = nowIso;
  }

  const resolvedLeadId = await updateLeadAfterEstimate(
    tenantId,
    v.leadId,
    v.phone,
    metadataPatch,
  );

  if (sendTeamSms) {
    const smsBody = buildEstimateSmsBody(v);
    await sendInternalSms({
      tenantId,
      leadId: resolvedLeadId,
      to,
      body: smsBody,
      messageType: 'g2g_estimate_lead',
    });

    const emailTo = process.env.G2G_ESTIMATE_NOTIFY_EMAIL?.trim();
    if (emailTo) {
      await sendInternalEmail({
        tenantId,
        to: emailTo,
        subject: '[G2G ESTIMATE] New estimate inquiry',
        body: buildEstimateEmailBody(v),
      });
    }
  } else {
    console.log(
      `[g2g-estimate] team SMS skipped (cooldown) lead=${resolvedLeadId || 'none'} phone=${v.phone}`,
    );
  }

  return { ok: true, leadId: resolvedLeadId, teamSmsSent: sendTeamSms };
};

module.exports = {
  startG2gLead,
  notifyG2gEstimateLead,
  updateLeadAfterEstimate,
  mergeMetadata,
  G2gLeadError,
  tenantIdForG2g,
};
