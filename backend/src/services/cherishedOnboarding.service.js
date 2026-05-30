const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const { normalizePhone } = require('./lead.service');
const { findTenantIdByUserEmail } = require('./tenant-service.service');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');
const tenantPhoneService = require('./tenant-phone.service');

const SOURCE = 'cherished_onboarding';
const ONBOARDING_TAG = 'onboarding';
const DEFAULT_USER_EMAIL = 'cherished_aesthetics@outlook.com';

class CherishedOnboardingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function trimStr(value, max) {
  const t = String(value ?? '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function portraitUrl() {
  return (process.env.CHERISHED_PORTRAIT_URL || '').trim();
}

async function resolveCherishedTenantId() {
  const explicit = (process.env.CHERISHED_TENANT_ID || '').trim();
  if (explicit) {
    const row = await db.query('SELECT id, name, phone_number FROM tenants WHERE id = $1 AND active = true', [explicit]);
    if (row.rows[0]) return row.rows[0];
  }

  const email = (process.env.CHERISHED_USER_EMAIL || DEFAULT_USER_EMAIL).trim();
  const tenant = await findTenantIdByUserEmail(email);
  if (!tenant) {
    throw new CherishedOnboardingError('Cherished Aesthetics tenant is not configured.', 503);
  }

  const full = await db.query(
    'SELECT id, name, phone_number FROM tenants WHERE id = $1 AND active = true',
    [tenant.id],
  );
  if (!full.rows[0]) {
    throw new CherishedOnboardingError('Cherished Aesthetics tenant is not active.', 503);
  }
  return full.rows[0];
}

function validateBody(body) {
  if (!body || typeof body !== 'object') {
    throw new CherishedOnboardingError('Invalid request body.');
  }

  const firstName = trimStr(body.firstName, 80);
  const lastName = trimStr(body.lastName, 80);
  const phone = trimStr(body.phone, 32);
  const email = trimStr(body.email, 254).toLowerCase();

  if (firstName.length < 1) {
    throw new CherishedOnboardingError('First name is required.');
  }
  if (lastName.length < 1) {
    throw new CherishedOnboardingError('Last name is required.');
  }
  if (!phone) {
    throw new CherishedOnboardingError('Phone number is required.');
  }
  if (!email || !isValidEmail(email)) {
    throw new CherishedOnboardingError('Enter a valid email address.');
  }

  return { firstName, lastName, phone, email };
}

async function mergeContactTag(contactId, tag) {
  const row = await db.query('SELECT tags FROM contacts WHERE id = $1', [contactId]);
  const existing = Array.isArray(row.rows[0]?.tags) ? row.rows[0].tags : [];
  if (existing.includes(tag)) return;
  const merged = [...existing, tag];
  await db.query(
    'UPDATE contacts SET tags = $2::jsonb, updated_at = NOW() WHERE id = $1',
    [contactId, JSON.stringify(merged)],
  );
}

async function maybeSendWelcomeSms(tenant, contactId, contact, portraitLink) {
  if (process.env.CHERISHED_ONBOARDING_SEND_WELCOME_SMS !== 'true') return false;
  if (!portraitLink) return false;

  const canSend = await compliance.canSendToContact(contactId);
  if (!canSend) return false;

  const template =
    process.env.CHERISHED_ONBOARDING_WELCOME_SMS
    || 'Hi {firstName}! Welcome to {businessName}. Access your patient portal here: {portraitLink}';

  const body = template
    .replace(/\{firstName\}/gi, contact.firstName || 'there')
    .replace(/\{businessName\}/gi, tenant.name || 'Cherished Aesthetics')
    .replace(/\{portraitLink\}/gi, portraitLink);

  const from = tenantPhoneService.resolveEffectiveSmsFrom(tenant.phone_number).from;
  await smsService.sendSms({
    tenantId: tenant.id,
    leadId: null,
    contactId,
    to: contact.phone,
    from,
    body,
    messageType: 'onboarding_welcome',
  });
  return true;
}

async function submitOnboarding(body) {
  const contactInput = validateBody(body);
  const tenant = await resolveCherishedTenantId();
  const link = portraitUrl();

  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(contactInput.phone);
  } catch {
    throw new CherishedOnboardingError('Enter a valid phone number.');
  }

  const existing = await db.query(
    `SELECT id FROM contacts
     WHERE tenant_id = $1 AND (phone = $2 OR LOWER(email) = LOWER($3))
     LIMIT 1`,
    [tenant.id, normalizedPhone, contactInput.email],
  );
  const isNew = existing.rows.length === 0;

  const contactId = await appointmentService.upsertContact(
    tenant.id,
    {
      firstName: contactInput.firstName,
      lastName: contactInput.lastName,
      phone: contactInput.phone,
      email: contactInput.email,
    },
    SOURCE,
  );

  await mergeContactTag(contactId, ONBOARDING_TAG);

  const welcomeSmsSent = await maybeSendWelcomeSms(tenant, contactId, contactInput, link);

  return {
    contactId,
    isNew,
    welcomeSmsSent,
    portraitUrl: link || null,
  };
}

function getPublicConfig() {
  return {
    portraitUrl: portraitUrl() || null,
    brandName: 'Cherished Aesthetics',
  };
}

module.exports = {
  submitOnboarding,
  getPublicConfig,
  CherishedOnboardingError,
};
