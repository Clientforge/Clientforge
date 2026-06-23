const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');
const { sendSms } = require('./sms.service');
const { sendEmail } = require('./email.service');
const { tenantIdForG2g, updateLeadAfterEstimate } = require('./graceG2gLead.service');
const smsProviderService = require('./sms-provider.service');

class SellIntentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const tenantIdForLogging = () => tenantIdForG2g();

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
  const address = trimStr(body.address, 500);
  if (address.length < 8) {
    throw new SellIntentError('Enter your full street address for pickup (city, state, ZIP).');
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

  const manualReviewRequired = body.manualReviewRequired === true;
  const email = trimStr(body.email, 254).toLowerCase() || null;
  const leadId = trimStr(body.leadId, 64) || null;
  const pickupNotes = trimStr(body.pickupNotes, 500) || null;

  return {
    customerName,
    address,
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
    manualReviewRequired,
    email,
    leadId,
    pickupNotes,
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
  const reviewPart = v.manualReviewRequired ? `\nReview: MANUAL (confirm custom quote)` : '';
  const emailPart = v.email ? `\nEmail: ${v.email}` : '';
  const notesPart = v.pickupNotes ? `\nNotes: ${v.pickupNotes}` : '';
  return (
    `[G2G] READY TO SELL\n` +
    `Name: ${v.customerName}\n` +
    `Phone: ${v.customerPhone}` +
    emailPart +
    `\nAddress: ${v.address}\n` +
    `Vehicle: ${v.year} ${v.make} ${v.model}\n` +
    `VIN: ${vinPart}\n` +
    `Condition: ${condPart}\n` +
    `ZIP: ${v.zip}\n` +
    `Mileage: ${miPart}\n` +
    `Est. range: ${estPart}` +
    notesPart +
    reviewPart
  ).slice(0, 1500);
}

async function resolveFromNumber(tenantId) {
  const r = await db.query('SELECT phone_number, sms_provider FROM tenants WHERE id = $1', [tenantId]);
  const row = r.rows[0];
  if (row?.phone_number) return row.phone_number;
  return smsProviderService.getPlatformDefaultFrom(row?.sms_provider);
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

  const resolvedLeadId = await updateLeadAfterEstimate(tenantId, v.leadId, v.customerPhone, {
    funnelStage: 'READY_TO_SELL',
    readyToSellAt: new Date().toISOString(),
    pickup: { address: v.address, notes: v.pickupNotes || null },
    vehicle: {
      year: v.year,
      make: v.make,
      model: v.model,
      zip: v.zip,
      vin: v.vin,
      mileage: v.mileage,
      conditionLabel: v.conditionLabel,
    },
    estimate: { low: v.estimateLow, high: v.estimateHigh },
  });

  await sendSms({
    tenantId,
    leadId: resolvedLeadId,
    contactId: null,
    to,
    from,
    body: smsBody,
    messageType: 'g2g_sell_intent',
  });

  const sellEmailTo =
    process.env.G2G_SELL_NOTIFY_EMAIL?.trim() ||
    process.env.G2G_ESTIMATE_NOTIFY_EMAIL?.trim();
  if (sellEmailTo) {
    await sendEmail({
      tenantId,
      to: sellEmailTo,
      fromName: 'Grace to Grace',
      subject: '[G2G] READY TO SELL',
      body: smsBody,
    });
  }

  return { ok: true, leadId: resolvedLeadId };
};

module.exports = {
  processSellIntent,
  SellIntentError,
};
