const db = require('../db/connection');
const config = require('../config');
const { normalizePhone } = require('./lead.service');

const VALID_PROVIDERS = new Set(['twilio', 'telnyx']);

const phonesMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    return normalizePhone(a) === normalizePhone(b);
  } catch {
    return false;
  }
};

/**
 * Normalize tenant/provider input. null = use routing fallback.
 */
const normalizeSmsProvider = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value).trim().toLowerCase();
  if (!VALID_PROVIDERS.has(v)) {
    throw Object.assign(new Error('SMS provider must be twilio or telnyx'), {
      statusCode: 400,
      isOperational: true,
    });
  }
  return v;
};

const getFallbackProvider = () => config.sms.provider || 'twilio';

const getPlatformDefaultFrom = (provider) => {
  const p = provider || getFallbackProvider();
  return p === 'telnyx' ? config.telnyx.defaultFrom : config.twilio.defaultFrom;
};

/**
 * Resolve which API to use for outbound SMS (sync — tenant row already loaded).
 */
const resolveSmsProviderFromContext = ({ tenantSmsProvider, fromNumber }) => {
  const explicit = normalizeSmsProvider(tenantSmsProvider);
  if (explicit) return explicit;

  if (fromNumber) {
    if (config.telnyx.defaultFrom && phonesMatch(fromNumber, config.telnyx.defaultFrom)) {
      return 'telnyx';
    }
    if (config.twilio.defaultFrom && phonesMatch(fromNumber, config.twilio.defaultFrom)) {
      return 'twilio';
    }
  }

  return getFallbackProvider();
};

/**
 * Load tenant sms_provider and resolve outbound API.
 */
const resolveSmsProvider = async (tenantId, fromNumber) => {
  let tenantSmsProvider = null;
  if (tenantId) {
    const r = await db.query('SELECT sms_provider FROM tenants WHERE id = $1', [tenantId]);
    tenantSmsProvider = r.rows[0]?.sms_provider ?? null;
  }
  return resolveSmsProviderFromContext({ tenantSmsProvider, fromNumber });
};

module.exports = {
  VALID_PROVIDERS,
  normalizeSmsProvider,
  getFallbackProvider,
  getPlatformDefaultFrom,
  resolveSmsProviderFromContext,
  resolveSmsProvider,
};
