const { normalizePhone } = require('./lead.service');
const { tenantIdForG2g, updateLeadAfterEstimate } = require('./graceG2gLead.service');

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

/**
 * Public Cash4JunkCar "Sell now" — updates lead only (no staff SMS/email; estimate notify is separate).
 */
const processSellIntent = async (body) => {
  const v = validatePayload(body);
  const tenantId = tenantIdForLogging();

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

  return { ok: true, leadId: resolvedLeadId };
};

module.exports = {
  processSellIntent,
  SellIntentError,
};
