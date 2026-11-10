/**
 * ALLDATA Manage Online Generic Export CSV → ClientForge canonical shapes.
 * Column names vary by export version — match flexibly.
 */

const crypto = require('crypto');
const { parse } = require('csv-parse/sync');

const PROVIDER = 'alldata';

function normalizeCsvKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\*+$/, '')
    .replace(/[\s_-]+/g, '');
}

function pickCsvField(row, ...aliases) {
  const wanted = new Set(aliases.map(normalizeCsvKey));
  for (const [key, value] of Object.entries(row || {})) {
    if (!wanted.has(normalizeCsvKey(key))) continue;
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function parseCsvBuffer(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : String(buffer || '');
  const trimmed = text.replace(/^\uFEFF/, '');
  if (!trimmed.trim()) return [];
  return parse(trimmed, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

function classifyExportFile(fileName) {
  const base = String(fileName || '').toLowerCase().replace(/\.(csv|txt)$/i, '');
  if (base.includes('customer')) return 'customers';
  if (base.includes('vehicle')) return 'vehicles';
  if (base.includes('deferred')) return 'deferred_work';
  if (base.includes('repair') || base.includes('invoice') || base.includes('order')) return 'repair_orders';
  return null;
}

function parseMoneyToCents(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function parseDateTime(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3]);
    const hour = slash[4] != null ? Number(slash[4]) : 12;
    const minute = slash[5] != null ? Number(slash[5]) : 0;
    const second = slash[6] != null ? Number(slash[6]) : 0;
    const d = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pickPrimaryPhone(row) {
  const cell = pickCsvField(row, 'cell', 'cellphone', 'cell phone', 'mobile', 'primary phone');
  if (cell) return cell;
  const home = pickCsvField(row, 'home', 'homephone', 'home phone');
  if (home) return home;
  return pickCsvField(row, 'phone', 'work phone', 'workphone', 'telephone');
}

function normalizeCustomerRow(row) {
  const alldataCustomerId = pickCsvField(
    row,
    'customerid',
    'customer id',
    'cust id',
    'custid',
    'customer_id',
  );
  if (!alldataCustomerId) return null;

  const firstName = pickCsvField(row, 'firstname', 'first name', 'first', 'fname');
  const lastName = pickCsvField(row, 'lastname', 'last name', 'last', 'lname');
  const phone = pickPrimaryPhone(row);
  const email = pickCsvField(row, 'email', 'e-mail', 'email address');
  if (!phone && !email && !firstName && !lastName) return null;

  return {
    alldataCustomerId: String(alldataCustomerId).trim(),
    firstName: firstName || null,
    lastName: lastName || null,
    phone: phone || null,
    email: email || null,
    rawPayload: row,
  };
}

function normalizeCustomerList(buffer) {
  return parseCsvBuffer(buffer).map(normalizeCustomerRow).filter(Boolean);
}

function normalizeVehicleRow(row) {
  const alldataCustomerId = pickCsvField(
    row,
    'customerid',
    'customer id',
    'cust id',
    'owner id',
  );
  const vehicleId = pickCsvField(
    row,
    'vehicleid',
    'vehicle id',
    'veh id',
    'vehid',
  );
  if (!alldataCustomerId) return null;

  const year = pickCsvField(row, 'year', 'vehicle year', 'modelyear');
  const make = pickCsvField(row, 'make', 'vehicle make');
  const model = pickCsvField(row, 'model', 'vehicle model');
  const vin = pickCsvField(row, 'vin');
  const license = pickCsvField(row, 'license', 'license plate', 'plate', 'lic');
  const mileage = pickCsvField(row, 'mileage', 'odometer');

  const parts = [year, make, model].filter(Boolean);
  let vehicleLabel = parts.join(' ').trim();
  if (!vehicleLabel && license) vehicleLabel = `Plate ${license}`;
  if (!vehicleLabel && vin) vehicleLabel = `VIN …${String(vin).slice(-6)}`;

  return {
    alldataCustomerId: String(alldataCustomerId).trim(),
    alldataVehicleId: vehicleId ? String(vehicleId).trim() : null,
    vehicleLabel: vehicleLabel || null,
    vin: vin || null,
    license: license || null,
    mileage: mileage || null,
    rawPayload: row,
  };
}

function normalizeVehicleList(buffer) {
  return parseCsvBuffer(buffer).map(normalizeVehicleRow).filter(Boolean);
}

function normalizeRepairOrderLine(row) {
  const orderId = pickCsvField(
    row,
    'repairorderid',
    'repair order id',
    'repair order',
    'ro number',
    'ronumber',
    'invoiceid',
    'invoice id',
    'invoice number',
    'document id',
    'documentid',
  );
  const customerId = pickCsvField(row, 'customerid', 'customer id', 'cust id');
  if (!orderId || !customerId) return null;

  const vehicleId = pickCsvField(row, 'vehicleid', 'vehicle id', 'veh id');
  const completedAt = parseDateTime(pickCsvField(
    row,
    'invoicedate',
    'invoice date',
    'completeddate',
    'completed date',
    'closeddate',
    'closed date',
    'date',
  ));

  const serviceName = pickCsvField(
    row,
    'jobdescription',
    'job description',
    'description',
    'servicedescription',
    'service description',
    'workdescription',
    'work description',
    'line description',
    'part description',
    'labor description',
    'item description',
  );

  const lineTotalCents = parseMoneyToCents(pickCsvField(row, 'total', 'line total', 'amount', 'extended'));

  return {
    alldataRepairOrderId: String(orderId).trim(),
    alldataCustomerId: String(customerId).trim(),
    alldataVehicleId: vehicleId ? String(vehicleId).trim() : null,
    completedAt,
    serviceLineName: serviceName || null,
    lineTotalCents,
    rawPayload: row,
  };
}

function formatServiceNameFromLines(lines) {
  const names = [...new Set(lines.map((l) => l.serviceLineName).filter(Boolean))];
  if (names.length === 0) return 'Service visit';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and others`;
}

function groupRepairOrders(buffer) {
  const lines = parseCsvBuffer(buffer).map(normalizeRepairOrderLine).filter(Boolean);
  const byOrder = new Map();

  for (const line of lines) {
    const key = line.alldataRepairOrderId;
    if (!byOrder.has(key)) {
      byOrder.set(key, {
        alldataRepairOrderId: key,
        alldataCustomerId: line.alldataCustomerId,
        alldataVehicleId: line.alldataVehicleId,
        completedAt: line.completedAt,
        serviceLines: [],
        totalCents: 0,
        rawPayload: { lines: [] },
      });
    }
    const order = byOrder.get(key);
    if (line.completedAt && (!order.completedAt || line.completedAt > order.completedAt)) {
      order.completedAt = line.completedAt;
    }
    if (line.alldataVehicleId) order.alldataVehicleId = line.alldataVehicleId;
    if (line.serviceLineName) order.serviceLines.push(line.serviceLineName);
    if (line.lineTotalCents) order.totalCents += line.lineTotalCents;
    order.rawPayload.lines.push(line.rawPayload);
  }

  return [...byOrder.values()].map((order) => ({
    alldataRepairOrderId: order.alldataRepairOrderId,
    alldataCustomerId: order.alldataCustomerId,
    alldataVehicleId: order.alldataVehicleId,
    completedAt: order.completedAt,
    serviceName: formatServiceNameFromLines(
      order.rawPayload.lines.map((r) => normalizeRepairOrderLine(r)).filter(Boolean),
    ),
    performedServices: [...new Set(order.serviceLines)].map((name, idx) => ({
      id: `${order.alldataRepairOrderId}:line:${idx}`,
      name,
    })),
    totalCents: order.totalCents || null,
    externalId: `${PROVIDER}:repair_order:${order.alldataRepairOrderId}`,
    rawPayload: order.rawPayload,
  }));
}

function buildDeferredRowKey(row) {
  const explicit = pickCsvField(row, 'deferredid', 'deferred id', 'deferred work id');
  if (explicit) return String(explicit).trim();
  const customerId = pickCsvField(row, 'customerid', 'customer id');
  const orderId = pickCsvField(row, 'repairorderid', 'repair order id', 'ro number', 'invoice id');
  const service = pickCsvField(
    row,
    'jobdescription',
    'job description',
    'description',
    'service',
    'work description',
  );
  const deferredAt = pickCsvField(row, 'deferreddate', 'deferred date', 'date deferred', 'date');
  const payload = `${customerId}|${orderId}|${service}|${deferredAt}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

function normalizeDeferredRow(row) {
  const customerId = pickCsvField(row, 'customerid', 'customer id', 'cust id');
  const serviceName = pickCsvField(
    row,
    'jobdescription',
    'job description',
    'description',
    'service',
    'work description',
    'deferred work',
  );
  if (!customerId || !serviceName) return null;

  const orderId = pickCsvField(
    row,
    'repairorderid',
    'repair order id',
    'ro number',
    'invoice id',
    'document id',
  );
  const vehicleId = pickCsvField(row, 'vehicleid', 'vehicle id');

  return {
    alldataDeferredId: buildDeferredRowKey(row),
    alldataCustomerId: String(customerId).trim(),
    alldataRepairOrderId: orderId ? String(orderId).trim() : null,
    alldataVehicleId: vehicleId ? String(vehicleId).trim() : null,
    serviceName: String(serviceName).trim(),
    deferredAt: parseDateTime(pickCsvField(
      row,
      'deferreddate',
      'deferred date',
      'date deferred',
      'declined date',
    )),
    dueAt: parseDateTime(pickCsvField(row, 'duedate', 'due date', 'follow up date')),
    deferredReason: pickCsvField(row, 'reason', 'deferred reason', 'reason deferred', 'decline reason'),
    totalCents: parseMoneyToCents(pickCsvField(row, 'total', 'amount', 'estimate')),
    externalId: `${PROVIDER}:deferred:${buildDeferredRowKey(row)}`,
    rawPayload: row,
  };
}

function normalizeDeferredList(buffer) {
  return parseCsvBuffer(buffer).map(normalizeDeferredRow).filter(Boolean);
}

function fileFingerprint(fileName, buffer, modifyTime) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 40);
  const mtime = modifyTime != null ? String(modifyTime) : '';
  return `${fileName}|${mtime}|${hash}`;
}

module.exports = {
  PROVIDER,
  parseCsvBuffer,
  classifyExportFile,
  normalizeCustomerList,
  normalizeVehicleList,
  groupRepairOrders,
  normalizeDeferredList,
  fileFingerprint,
};
