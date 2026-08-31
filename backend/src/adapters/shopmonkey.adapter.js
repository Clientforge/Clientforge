/**
 * Shopmonkey webhook payload → ClientForge canonical shapes.
 *
 * Webhook body: { operation, table, data, diff?, apiVersion }
 * @see https://shopmonkey.dev/webhooks
 */

const PROVIDER = 'shopmonkey';

const pickPrimaryPhone = (customer) => {
  const phones = customer?.phoneNumbers || [];
  const primary = phones.find((p) => p.primary) || phones[0];
  return primary?.number?.trim() || null;
};

const pickPrimaryEmail = (customer) => {
  const emails = customer?.emails || [];
  const primary = emails.find((e) => e.primary) || emails[0];
  return primary?.email?.trim() || null;
};

const pickSmsOptIn = (customer) => {
  const phones = customer?.phoneNumbers || [];
  const primary = phones.find((p) => p.primary) || phones[0];
  if (primary && primary.optIn === false) return false;
  return true;
};

const normalizeCustomerContact = (customer) => {
  if (!customer?.id) return null;
  const firstName = customer.firstName || customer.companyName || null;
  const lastName = customer.lastName || null;
  const phone = pickPrimaryPhone(customer);
  const email = pickPrimaryEmail(customer);
  if (!phone && !email && !firstName) return null;

  return {
    shopmonkeyCustomerId: customer.id,
    firstName,
    lastName,
    phone,
    email,
    smsOptIn: pickSmsOptIn(customer),
    rawPayload: customer,
  };
};

const orderIsComplete = (order) => {
  if (!order) return false;
  if (order.deleted) return false;
  if (order.completedDate) return true;
  if (order.invoiced && order.status === 'Invoice') return true;
  if (order.paid && order.fullyPaidDate) return true;
  return false;
};

const extractOrderVehicleLabel = (order) => {
  if (!order) return null;
  const label = order.generatedVehicleName || order.vehicle?.generatedName || null;
  return label ? String(label).trim() : null;
};

const isPerformedOrderService = (service) => {
  if (!service?.name || !String(service.name).trim()) return false;
  if (service.hidden === true) return false;
  const status = String(service.authorizationStatus || '').toLowerCase();
  if (status.includes('declin')) return false;
  return true;
};

const normalizeOrderServiceItem = (item) => {
  if (!item?.id || !item?.name) return null;
  return {
    id: String(item.id),
    name: String(item.name).trim(),
    authorizationStatus: item.authorizationStatus || null,
    completed: item.completed === true,
    recommended: item.recommended === true,
    hidden: item.hidden === true,
    rawPayload: item,
  };
};

const normalizeOrderServiceList = (response) => {
  const rows = Array.isArray(response?.data)
    ? response.data
    : (Array.isArray(response) ? response : []);
  return rows.map(normalizeOrderServiceItem).filter(Boolean);
};

const formatOrderServiceName = (services, order = {}) => {
  const names = (services || [])
    .map((s) => s.name)
    .filter(Boolean);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length > 2) return `${names[0]}, ${names[1]}, and others`;

  const fallback = order.name || order.coalescedName || order.generatedName || null;
  return fallback ? String(fallback).trim() : 'Service visit';
};

const buildOrderServiceContext = (order, services = []) => {
  const performed = services.filter(isPerformedOrderService);
  const vehicleLabel = extractOrderVehicleLabel(order);
  const serviceName = formatOrderServiceName(performed, order);

  return {
    serviceName,
    vehicleLabel,
    performedServices: performed,
    rawPayload: {
      ...order,
      shopmonkeyVehicleLabel: vehicleLabel,
      shopmonkeyServices: performed.map((s) => ({
        id: s.id,
        name: s.name,
        authorizationStatus: s.authorizationStatus,
      })),
    },
  };
};

const normalizeOrderEvent = (order, operation) => {
  if (!order?.id) return null;
  const complete = orderIsComplete(order);
  const scheduledAt = order.completedDate || order.invoicedDate || order.orderCreatedDate || order.createdDate;
  const vehicleLabel = extractOrderVehicleLabel(order);

  return {
    kind: 'order',
    operation,
    orderId: order.id,
    customerId: order.customerId || null,
    vehicleId: order.vehicleId || null,
    isComplete: complete,
    serviceName: formatOrderServiceName([], order),
    vehicleLabel,
    scheduledAt,
    revenueCents: order.totalCostCents ?? order.paidCostCents ?? null,
    externalId: `${PROVIDER}:order:${order.id}`,
    rawPayload: order,
  };
};

const normalizeAppointmentEvent = (appointment, operation) => {
  if (!appointment?.id) return null;
  const cancelled = operation === 'DELETE' || !!appointment.cancellationNote;

  return {
    kind: 'appointment',
    operation,
    eventType: cancelled ? 'booking.cancelled' : 'booking.created',
    customerId: appointment.customerId || null,
    vehicleId: appointment.vehicleId || null,
    scheduledAt: appointment.startDate,
    timezone: null,
    serviceName: appointment.name || 'Appointment',
    durationMinutes: appointment.duration || null,
    externalId: `${PROVIDER}:appointment:${appointment.id}`,
    rawPayload: appointment,
  };
};

/**
 * @returns {{ table, operation, customer?, order?, appointment? } | null}
 */
const normalizeShopmonkeyWebhook = (body) => {
  if (!body || typeof body !== 'object') return null;

  const operation = body.operation || body.op || null;
  const table = body.table || body.object || null;
  const data = body.data || body.payload || body;

  if (!operation || !table) return null;

  const tableNorm = String(table).toLowerCase().replace(/-/g, '_');

  if (tableNorm === 'customer') {
    const contact = normalizeCustomerContact(data);
    if (!contact) return null;
    return { table: 'customer', operation, customer: data, contact };
  }

  if (tableNorm === 'order') {
    const order = normalizeOrderEvent(data, operation);
    if (!order) return null;
    return { table: 'order', operation, order };
  }

  if (tableNorm === 'appointment') {
    const appointment = normalizeAppointmentEvent(data, operation);
    if (!appointment) return null;
    return { table: 'appointment', operation, appointment };
  }

  return { table: tableNorm, operation, skipped: true };
};

const shouldIncludeDeferredService = (item) => {
  if (!item?.id) return false;
  if (item.excludedFromDeferred === true) return false;
  if (item.hidden === true) return false;
  if (!item.name || !String(item.name).trim()) return false;
  return true;
};

const normalizeDeferredServiceItem = (item) => {
  if (!shouldIncludeDeferredService(item)) return null;

  const deferredAt = item.deferredDate || item.createdDate || item.updatedDate || null;
  const vehicleLabel = item.order?.generatedVehicleName
    || item.order?.generatedCustomerName
    || null;

  return {
    shopmonkeyDeferredId: String(item.id),
    shopmonkeyOrderId: item.orderId ? String(item.orderId) : null,
    shopmonkeyCustomerId: item.order?.customerId ? String(item.order.customerId) : null,
    serviceName: String(item.name).trim(),
    vehicleLabel,
    deferredAt,
    deferredReason: item.deferredReason || item.authorizationStatus || null,
    totalCents: Number.isFinite(item.totalCents) ? item.totalCents : null,
    externalId: `${PROVIDER}:deferred:${item.id}`,
    rawPayload: item,
  };
};

const normalizeDeferredServiceList = (response, { orderId } = {}) => {
  const rows = Array.isArray(response?.data)
    ? response.data
    : (Array.isArray(response) ? response : []);

  const normalized = rows
    .map(normalizeDeferredServiceItem)
    .filter(Boolean);

  if (!orderId) return normalized;

  const orderKey = String(orderId);
  return normalized.filter((row) => row.shopmonkeyOrderId === orderKey);
};

module.exports = {
  PROVIDER,
  normalizeShopmonkeyWebhook,
  normalizeCustomerContact,
  orderIsComplete,
  extractOrderVehicleLabel,
  isPerformedOrderService,
  normalizeOrderServiceItem,
  normalizeOrderServiceList,
  formatOrderServiceName,
  buildOrderServiceContext,
  normalizeDeferredServiceItem,
  normalizeDeferredServiceList,
  shouldIncludeDeferredService,
};
