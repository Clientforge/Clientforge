const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const tenantService = require('./tenant-service.service');
const { normalizePhone } = require('./lead.service');

const SOURCE = 'spatium_checkin';
const PROVIDER = 'spatium_checkin';
const DEFAULT_USER_EMAIL = 'draghogho@spatiumurgentcare.com';

const SERVICE_TYPES = [
  'Urgent Care Visit',
  'IV Hydration',
  'Massage Therapy',
  'Weight Management',
  'Wellness Services',
  'Other',
];

class SpatiumCheckInError extends Error {
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

function dateKeyInTimezone(isoString, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(isoString));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through
  }
  return new Date(isoString).toISOString().slice(0, 10);
}

async function resolveSpatiumTenant() {
  const explicit = (process.env.SPATIUM_TENANT_ID || '').trim();
  if (explicit) {
    const row = await db.query(
      `SELECT id, name, timezone, phone_number, sms_provider
       FROM tenants WHERE id = $1 AND active = true`,
      [explicit],
    );
    if (row.rows[0]) return row.rows[0];
  }

  const email = (process.env.SPATIUM_USER_EMAIL || DEFAULT_USER_EMAIL).trim();
  const tenant = await tenantService.findTenantIdByUserEmail(email);
  if (!tenant) {
    throw new SpatiumCheckInError('Spatium Urgent Care tenant is not configured.', 503);
  }

  const full = await db.query(
    `SELECT id, name, timezone, phone_number, sms_provider
     FROM tenants WHERE id = $1 AND active = true`,
    [tenant.id],
  );
  if (!full.rows[0]) {
    throw new SpatiumCheckInError('Spatium Urgent Care tenant is not active.', 503);
  }
  return full.rows[0];
}

function validateBody(body) {
  if (!body || typeof body !== 'object') {
    throw new SpatiumCheckInError('Invalid request body.');
  }

  const firstName = trimStr(body.firstName, 80);
  const lastName = trimStr(body.lastName, 80);
  const phone = trimStr(body.phone, 32);
  const serviceType = trimStr(body.serviceType, 120);

  if (firstName.length < 1) {
    throw new SpatiumCheckInError('First name is required.');
  }
  if (lastName.length < 1) {
    throw new SpatiumCheckInError('Last name is required.');
  }
  if (!phone) {
    throw new SpatiumCheckInError('Phone number is required.');
  }
  if (!serviceType || !SERVICE_TYPES.includes(serviceType)) {
    throw new SpatiumCheckInError('Select a valid service type.');
  }

  return { firstName, lastName, phone, serviceType };
}

async function upsertCheckInAppointment(tenantId, contactId, {
  checkInAt,
  timezone,
  serviceType,
}) {
  const dayKey = dateKeyInTimezone(checkInAt, timezone);
  const externalId = `spatium-checkin-${contactId}-${dayKey}`;

  const matched = await tenantService.matchService(tenantId, serviceType);

  const { id: appointmentId } = await appointmentService.upsertAppointment(
    tenantId,
    contactId,
    {
      externalId,
      provider: PROVIDER,
      scheduledAt: checkInAt,
      timezone: timezone || 'America/New_York',
      serviceName: serviceType,
      durationMinutes: 30,
      rawPayload: {
        source: SOURCE,
        serviceType,
        checkInAt,
        matchedServiceId: matched?.id || null,
      },
    },
    'checked_in',
  );

  await db.query(
    `UPDATE appointments SET
       status = 'checked_in',
       completed_at = $2,
       service_name = $3,
       matched_service_id = $4,
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $5`,
    [appointmentId, checkInAt, serviceType, matched?.id || null, tenantId],
  );

  return { appointmentId, externalId, matchedService: matched };
}

async function submitCheckIn(body) {
  const input = validateBody(body);
  const tenant = await resolveSpatiumTenant();

  try {
    normalizePhone(input.phone);
  } catch {
    throw new SpatiumCheckInError('Enter a valid phone number.');
  }

  const checkInAt = new Date().toISOString();
  const timezone = tenant.timezone || 'America/New_York';

  const existing = await db.query(
    'SELECT id FROM contacts WHERE tenant_id = $1 AND phone = $2 LIMIT 1',
    [tenant.id, normalizePhone(input.phone)],
  );
  const isNew = existing.rows.length === 0;

  const contactId = await appointmentService.upsertContact(
    tenant.id,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    },
    SOURCE,
  );

  await db.query(
    `UPDATE contacts
     SET last_visit_at = GREATEST(COALESCE(last_visit_at, $3::timestamptz), $3::timestamptz),
         updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [contactId, tenant.id, checkInAt],
  );

  const { appointmentId, matchedService } = await upsertCheckInAppointment(
    tenant.id,
    contactId,
    {
      checkInAt,
      timezone,
      serviceType: input.serviceType,
    },
  );

  const workflow = await appointmentWorkflowService.dispatchCheckInWorkflows(tenant.id, {
    contactId,
    appointmentId,
    checkedInAt: checkInAt,
    serviceName: input.serviceType,
  });

  return {
    contactId,
    appointmentId,
    isNew,
    checkInAt,
    serviceType: input.serviceType,
    matchedServiceId: matchedService?.id || null,
    matchedServiceName: matchedService?.name || null,
    ...workflow,
  };
}

function getPublicConfig() {
  return {
    brandName: 'Spatium Urgent Care',
    serviceTypes: SERVICE_TYPES,
  };
}

module.exports = {
  submitCheckIn,
  getPublicConfig,
  SpatiumCheckInError,
  SERVICE_TYPES,
};
