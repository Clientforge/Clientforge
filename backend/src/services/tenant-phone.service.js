const db = require('../db/connection');
const config = require('../config');
const { normalizePhone } = require('./lead.service');
const smsProviderService = require('./sms-provider.service');

/**
 * Normalize tenant SMS phone input. Empty / whitespace → null (use platform default).
 */
const parseTenantPhoneInput = (input) => {
  if (input === undefined) return undefined;
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  return normalizePhone(trimmed);
};

const getPlatformDefaultSmsFrom = (smsProvider = null) =>
  smsProviderService.getPlatformDefaultFrom(smsProvider);

/**
 * Resolve the number that will actually be used as SMS "From" for a tenant.
 */
const resolveEffectiveSmsFrom = (storedPhoneNumber, smsProvider = null) => {
  const trimmed = String(storedPhoneNumber ?? '').trim();
  if (trimmed) {
    try {
      return { from: normalizePhone(trimmed), source: 'tenant' };
    } catch {
      return { from: trimmed, source: 'tenant' };
    }
  }
  const provider = smsProviderService.resolveSmsProviderFromContext({
    tenantSmsProvider: smsProvider,
    fromNumber: null,
  });
  return {
    from: getPlatformDefaultSmsFrom(provider),
    source: 'platform_default',
    smsProvider: provider,
  };
};

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
 * Find tenant that owns an inbound SMS destination number (handles legacy formats).
 */
const findTenantIdByInboundSmsNumber = async (toRaw) => {
  if (!toRaw) return null;

  let toNorm;
  try {
    toNorm = normalizePhone(toRaw);
  } catch {
    toNorm = null;
  }

  const exact = await db.query(
    `SELECT id FROM tenants
     WHERE active = true
       AND phone_number IS NOT NULL
       AND phone_number != ''
       AND (phone_number = $1 OR ($2::text IS NOT NULL AND phone_number = $2))
     LIMIT 1`,
    [toRaw, toNorm],
  );
  if (exact.rows[0]) return exact.rows[0].id;

  const all = await db.query(
    `SELECT id, phone_number FROM tenants
     WHERE active = true AND phone_number IS NOT NULL AND phone_number != ''`,
  );
  for (const row of all.rows) {
    if (phonesMatch(row.phone_number, toRaw)) return row.id;
  }

  return null;
};

/**
 * Remove a number from any other tenant before assigning it.
 */
const clearPhoneFromOtherTenants = async (normalizedPhone, exceptTenantId) => {
  if (!normalizedPhone) return 0;

  const others = await db.query(
    `SELECT id, name, phone_number FROM tenants
     WHERE id != $1 AND phone_number IS NOT NULL AND phone_number != ''`,
    [exceptTenantId],
  );

  let cleared = 0;
  for (const row of others.rows) {
    if (!phonesMatch(row.phone_number, normalizedPhone)) continue;
    await db.query(
      `UPDATE tenants SET phone_number = NULL, updated_at = NOW() WHERE id = $1`,
      [row.id],
    );
    cleared += 1;
    console.log(
      `[SMS] Released ${normalizedPhone} from tenant "${row.name}" (${row.id}) — reassigned`,
    );
  }
  return cleared;
};

/**
 * Assign (or clear) a tenant's dedicated SMS number. Clears duplicates elsewhere.
 */
const assignPhoneNumberToTenant = async (tenantId, rawInput, smsProviderInput) => {
  const parsed = parseTenantPhoneInput(rawInput);
  if (parsed === undefined) {
    throw Object.assign(new Error('Phone number input is required'), { statusCode: 400, isOperational: true });
  }

  if (parsed) {
    await clearPhoneFromOtherTenants(parsed, tenantId);
  }

  let smsProviderSql = '';
  const params = [parsed, tenantId];
  if (smsProviderInput !== undefined) {
    const normalized = smsProviderService.normalizeSmsProvider(smsProviderInput);
    smsProviderSql = ', sms_provider = $3';
    params.push(normalized);
  }

  const result = await db.query(
    `UPDATE tenants SET phone_number = $1, updated_at = NOW()${smsProviderSql} WHERE id = $2
     RETURNING phone_number, sms_provider`,
    params,
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const row = result.rows[0];
  const effective = resolveEffectiveSmsFrom(row.phone_number, row.sms_provider);
  const resolvedProvider = smsProviderService.resolveSmsProviderFromContext({
    tenantSmsProvider: row.sms_provider,
    fromNumber: effective.from,
  });

  return {
    phoneNumber: row.phone_number,
    smsProvider: row.sms_provider,
    effectiveSmsFrom: effective.from,
    effectiveSmsProvider: resolvedProvider,
    smsFromSource: effective.source,
  };
};

/**
 * Update sms_provider only (Settings / admin).
 */
const assignSmsProviderToTenant = async (tenantId, smsProviderInput) => {
  const normalized = smsProviderService.normalizeSmsProvider(smsProviderInput);
  const result = await db.query(
    `UPDATE tenants SET sms_provider = $1, updated_at = NOW() WHERE id = $2
     RETURNING phone_number, sms_provider`,
    [normalized, tenantId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const row = result.rows[0];
  const effective = resolveEffectiveSmsFrom(row.phone_number, row.sms_provider);
  const resolvedProvider = smsProviderService.resolveSmsProviderFromContext({
    tenantSmsProvider: row.sms_provider,
    fromNumber: effective.from,
  });

  return {
    phoneNumber: row.phone_number,
    smsProvider: row.sms_provider,
    effectiveSmsFrom: effective.from,
    effectiveSmsProvider: resolvedProvider,
    smsFromSource: effective.source,
  };
};

module.exports = {
  parseTenantPhoneInput,
  getPlatformDefaultSmsFrom,
  resolveEffectiveSmsFrom,
  findTenantIdByInboundSmsNumber,
  clearPhoneFromOtherTenants,
  assignPhoneNumberToTenant,
  assignSmsProviderToTenant,
  phonesMatch,
};
