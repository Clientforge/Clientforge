/**
 * OptiMantra Superbill Checkout webhook → canonical checkout event.
 *
 * Field names are flexible until a live payload is captured — update keys after
 * webhook.site sample from OptiMantra Superbill Checkout trigger.
 */

const {
  pickFirst,
  splitFullName,
  resolveExternalId,
  parseScheduledAt,
} = require('./optimantra.adapter');

const PHONE_KEYS = [
  'phone', 'phoneNumber', 'phone_number', 'mobile', 'patientPhone', 'patient_phone',
  'patient.phone', 'contact.phone',
];

const EMAIL_KEYS = [
  'email', 'emailAddress', 'patientEmail', 'patient_email', 'patient.email',
];

const FIRST_NAME_KEYS = [
  'firstName', 'first_name', 'patientFirstName', 'patient.firstName',
];

const LAST_NAME_KEYS = [
  'lastName', 'last_name', 'patientLastName', 'patient.lastName',
];

const FULL_NAME_KEYS = ['name', 'fullName', 'patientName', 'patient.name'];

const PATIENT_ID_KEYS = [
  'patientId', 'patient_id', 'patientID', 'optimantraPatientId', 'patient.id',
];

const CHECKOUT_ID_KEYS = [
  'superbillId', 'superbill_id', 'checkoutId', 'checkout_id', 'superBillId',
  'invoiceId', 'invoice_id', 'id', 'transactionId', 'transaction_id',
];

const CHECKOUT_AT_KEYS = [
  'checkoutDate', 'checkout_date', 'checkedOutAt', 'checked_out_at', 'checkoutTime',
  'checkout_time', 'superbillDate', 'superbill_date', 'completedAt', 'completed_at',
  'dateTime', 'date_time',
];

const SERVICE_LIST_KEYS = [
  'services', 'lineItems', 'line_items', 'superbillLines', 'superbill_lines',
  'items', 'procedures', 'treatments', 'serviceLines', 'service_lines',
];

function titleCaseServiceType(raw) {
  if (!raw) return null;
  const lower = String(raw).trim().toLowerCase();
  if (lower === 'office visit') return 'Office Visit';
  if (lower === 'procedure') return 'Procedure';
  if (lower === 'lab work') return 'Lab Work';
  if (lower === 'other') return 'Other';
  return String(raw).trim();
}

function parseLineItem(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const serviceName = pickFirst(raw, [
    'serviceName', 'service_name', 'service', 'name', 'procedureName', 'procedure_name',
    'treatment', 'treatmentName', 'description', 'itemName', 'item_name',
  ]);

  const serviceType = titleCaseServiceType(pickFirst(raw, [
    'serviceType', 'service_type', 'type', 'visitType', 'visit_type', 'category',
    'procedureType', 'procedure_type',
  ]));

  if (!serviceName && !serviceType) return null;

  return {
    serviceName: serviceName || serviceType || 'Service',
    serviceType: serviceType || 'Other',
  };
}

function extractServices(payload) {
  for (const key of SERVICE_LIST_KEYS) {
    const list = payload[key];
    if (!Array.isArray(list)) continue;
    const parsed = list.map(parseLineItem).filter(Boolean);
    if (parsed.length > 0) return parsed;
  }

  const singleName = pickFirst(payload, [
    'serviceName', 'service_name', 'service', 'primaryService', 'primary_service',
  ]);
  const singleType = titleCaseServiceType(pickFirst(payload, [
    'serviceType', 'service_type', 'visitType', 'visit_type', 'type',
  ]));

  if (singleName || singleType) {
    return [{
      serviceName: singleName || singleType || 'Service',
      serviceType: singleType || 'Other',
    }];
  }

  return [];
}

function resolveCheckoutExternalId(payload) {
  const id = pickFirst(payload, CHECKOUT_ID_KEYS);
  if (!id) return null;
  if (String(id).startsWith('optimantra:superbill:')) return String(id);
  return `optimantra:superbill:${id}`;
}

function resolveCheckedOutAt(payload) {
  const raw = pickFirst(payload, CHECKOUT_AT_KEYS);
  if (raw) {
    const parsed = parseScheduledAt(raw);
    if (parsed) return parsed;
  }
  return new Date().toISOString();
}

/**
 * @param {object} raw OptiMantra superbill checkout webhook body
 * @returns {{ contact: object, checkout: object, services: array } | null}
 */
function normalizeOptimantraSuperbillPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : raw;

  let firstName = pickFirst(payload, FIRST_NAME_KEYS);
  let lastName = pickFirst(payload, LAST_NAME_KEYS);

  if (!firstName) {
    const fromFull = splitFullName(pickFirst(payload, FULL_NAME_KEYS));
    firstName = fromFull.firstName;
    lastName = lastName || fromFull.lastName;
  }

  const phone = pickFirst(payload, PHONE_KEYS);
  const email = pickFirst(payload, EMAIL_KEYS);
  const patientId = pickFirst(payload, PATIENT_ID_KEYS);
  const externalId = resolveCheckoutExternalId(payload);
  const appointmentExternalId = resolveExternalId(payload);
  const checkedOutAt = resolveCheckedOutAt(payload);
  const services = extractServices(payload);

  if (!externalId && !phone && !email && !patientId) {
    return null;
  }

  if (services.length === 0) {
    return null;
  }

  return {
    contact: {
      firstName,
      lastName,
      phone,
      email,
      optimantraPatientId: patientId,
    },
    checkout: {
      externalId: externalId || `optimantra:superbill:${Date.now()}`,
      provider: 'optimantra',
      checkedOutAt,
      appointmentExternalId,
      rawPayload: raw,
    },
    services,
  };
}

module.exports = {
  normalizeOptimantraSuperbillPayload,
  titleCaseServiceType,
  parseLineItem,
  extractServices,
};
