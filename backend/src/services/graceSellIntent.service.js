const db = require('../db/connection');
const config = require('../config');
const { normalizePhone } = require('./lead.service');
const { sendSms } = require('./sms.service');

const PLATFORM_TENANT_DEFAULT = '00000000-0000-0000-0000-000000000001';

class SellIntentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const tenantIdForLogging = () =>
  process.env.G2G_SELL_INTENT_TENANT_ID?.trim() || PLATFORM_TENANT_DEFAULT;

function trimStr(s, max) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new SellIntentError('Invalid request body.');
  }
  if (body.smsConsent !== true) {
    throw new SellIntentError(
      'Consent is required to submit your phone number so we can follow up by text.',
    );
  }
  const customerName = trimStr(body.customerName, 120);
  if (customerName.length < 2) {
    throw new SellIntentError('Enter your full name (at least 2 characters).');
  }
  const phoneRaw = trimStr(body.phone, 32);
  if (!phoneRaw) {
    throw new SellIntentError('Phone number is required.');
  }
  let customerPhone;
  customerPhone = normalizePhone(phoneRaw);
  const digits = customerPhone.replace(/\D/g, '');
  if (digits.length < 10) {
    throw new SellIntentError('Enter a valid phone number.');
  }

  const year = trimStr(body.year, 4);
  const make = trimStr(body.make, 80);
  const model = trimStr(body.model, 80);
  const zip = trimStr(body.zip, 10).replace(/\D/g, '').slice(0, 5);
  if (!year || !make || !model) {
    throw new SellIntentError('Vehicle year, make, and model are required.');
  }
  if (zip.length < 5) {
    throw new SellIntentError('ZIP code is required.');
  }

  const vin = trimStr(body.vin, 17).toUpperCase().replace(/\s/g, '');
  const mileage = trimStr(body.mileage, 32);
  const conditionLabel = trimStr(body.conditionLabel, 500);

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

  return {
    customerName,
    customerPhone,
    year,
    make,
    model,
    zip,
    vin: vin || null,
    mileage: mileage || null,
    conditionLabel: conditionLabel || null,
    estimateLow,
    estimateHigh,
  };
}

function buildNotifySmsBody(v) {
  const vinPart = v.vin || '—';
  const miPart = v.mileage || '—';
  const condPart = v.conditionLabel || '—';
  const estPart =
    v.estimateLow != null && v.estimateHigh != null
      ? `$${v.estimateLow.toLocaleString()}–$${v.estimateHigh.toLocaleString()}`
      : '—';
  return (
    `[G2G] Ready to sell\n` +
    `Name: ${v.customerName}\n` +
    `Phone: ${v.customerPhone}\n` +
    `Vehicle: ${v.year} ${v.make} ${v.model}\n` +
    `VIN: ${vinPart}\n` +
    `Condition: ${condPart}\n` +
    `ZIP: ${v.zip}\n` +
    `Mileage: ${miPart}\n` +
    `Est. range: ${estPart}`
  ).slice(0, 1500);
}

async function resolveFromNumber(tenantId) {
  const r = await db.query('SELECT phone_number FROM tenants WHERE id = $1', [tenantId]);
  const row = r.rows[0];
  if (row?.phone_number) return row.phone_number;
  const provider = config.sms.provider || 'twilio';
  return provider === 'telnyx' ? config.telnyx.defaultFrom : config.twilio.defaultFrom;
}

/**
 * Public Grace-to-Grace "sell now" → SMS ops/staff number.
 */
const processSellIntent = async (body) => {
  const notifyRaw = process.env.G2G_SELL_NOTIFY_PHONE;
  if (!notifyRaw || !String(notifyRaw).trim()) {
    throw new SellIntentError(
      'Sell notifications are not configured. Set G2G_SELL_NOTIFY_PHONE.',
      503,
    );
  }

  let to;
  to = normalizePhone(String(notifyRaw).trim());
  const toDigits = to.replace(/\D/g, '');
  if (toDigits.length < 10) {
    throw new SellIntentError('Server misconfiguration: invalid G2G_SELL_NOTIFY_PHONE.', 503);
  }

  const v = validatePayload(body);
  const tenantId = tenantIdForLogging();
  const from = await resolveFromNumber(tenantId);
  const smsBody = buildNotifySmsBody(v);

  await sendSms({
    tenantId,
    leadId: null,
    contactId: null,
    to,
    from,
    body: smsBody,
    messageType: 'g2g_sell_intent',
  });

  return { ok: true };
};

module.exports = {
  processSellIntent,
  SellIntentError,
};
