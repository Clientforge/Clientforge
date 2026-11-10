const SftpClient = require('ssh2-sftp-client');
const db = require('../db/connection');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const { normalizePhone } = require('./lead.service');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const alldataDeferredService = require('./alldata-deferred.service');
const autoShopClassification = require('./auto-shop-classification.service');
const autoShopMaintenance = require('./auto-shop-maintenance.service');
const { isAlldataTenant } = require('../config/alldataTenant');
const {
  classifyExportFile,
  normalizeCustomerList,
  normalizeVehicleList,
  groupRepairOrders,
  normalizeDeferredList,
  fileFingerprint,
} = require('../adapters/alldata.adapter');

function formatConnection(row) {
  if (!row) {
    return { connected: false, configured: true };
  }
  return {
    connected: !!(row.sftp_host && row.sftp_username && (row.sftp_password_enc || row.sftp_private_key_enc)),
    sftpHost: row.sftp_host || '',
    sftpPort: row.sftp_port || 22,
    sftpUsername: row.sftp_username || '',
    remotePath: row.remote_path || '/',
    shopLabel: row.shop_label || null,
    syncEnabled: row.sync_enabled !== false,
    deferredFollowupEnabled: row.deferred_followup_enabled !== false,
    deferredFollowupSchedule: alldataDeferredService.normalizeFollowupSchedule(
      row.deferred_followup_schedule,
    ),
    lastSyncAt: row.last_sync_at || null,
    lastSyncError: row.last_sync_error || null,
    lastSyncStats: row.last_sync_stats || null,
    hasPassword: !!row.sftp_password_enc,
    hasPrivateKey: !!row.sftp_private_key_enc,
  };
}

async function getConnection(tenantId) {
  const result = await db.query(
    'SELECT * FROM tenant_alldata_connections WHERE tenant_id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getStatus(tenantId) {
  return formatConnection(await getConnection(tenantId));
}

async function getTenantName(tenantId) {
  const result = await db.query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
  return result.rows[0]?.name || '';
}

async function getTenantAutomationGate(tenantId) {
  const result = await db.query(
    `SELECT automation_test_mode, automation_live_at FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return result.rows[0] || {};
}

function shouldDispatchAutomations(tenantRow, eventAtIso) {
  if (tenantRow.automation_test_mode) return true;
  if (!tenantRow.automation_live_at) return false;
  if (!eventAtIso) return false;
  const eventAt = new Date(eventAtIso);
  const liveAt = new Date(tenantRow.automation_live_at);
  if (Number.isNaN(eventAt.getTime()) || Number.isNaN(liveAt.getTime())) return false;
  return eventAt >= liveAt;
}

async function connect(tenantId, {
  sftpHost,
  sftpPort,
  sftpUsername,
  sftpPassword,
  sftpPrivateKey,
  remotePath,
  shopLabel,
}) {
  const host = String(sftpHost || '').trim();
  const username = String(sftpUsername || '').trim();
  if (!host || !username) {
    throw Object.assign(new Error('SFTP host and username are required'), { statusCode: 400, isOperational: true });
  }
  if (!sftpPassword && !sftpPrivateKey) {
    throw Object.assign(new Error('SFTP password or private key is required'), { statusCode: 400, isOperational: true });
  }

  const port = Number(sftpPort) || 22;
  const pathValue = String(remotePath || '/').trim() || '/';

  await testSftpCredentials({
    sftpHost: host,
    sftpPort: port,
    sftpUsername: username,
    sftpPassword,
    sftpPrivateKey,
    remotePath: pathValue,
  });

  const existing = await getConnection(tenantId);
  const passwordEnc = sftpPassword ? encrypt(sftpPassword) : null;
  const keyEnc = sftpPrivateKey ? encrypt(sftpPrivateKey) : null;

  if (existing) {
    await db.query(
      `UPDATE tenant_alldata_connections SET
         sftp_host = $2,
         sftp_port = $3,
         sftp_username = $4,
         sftp_password_enc = COALESCE($5, sftp_password_enc),
         sftp_private_key_enc = COALESCE($6, sftp_private_key_enc),
         remote_path = $7,
         shop_label = COALESCE($8, shop_label),
         sync_enabled = true,
         updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, host, port, username, passwordEnc, keyEnc, pathValue, shopLabel || null],
    );
  } else {
    await db.query(
      `INSERT INTO tenant_alldata_connections (
         tenant_id, sftp_host, sftp_port, sftp_username,
         sftp_password_enc, sftp_private_key_enc, remote_path, shop_label, sync_enabled
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [tenantId, host, port, username, passwordEnc, keyEnc, pathValue, shopLabel || null],
    );
  }

  return getStatus(tenantId);
}

async function disconnect(tenantId) {
  await db.query('DELETE FROM tenant_alldata_connections WHERE tenant_id = $1', [tenantId]);
  return { connected: false, configured: true };
}

async function updateSettings(tenantId, {
  syncEnabled,
  deferredFollowupEnabled,
  deferredFollowupSchedule,
  shopLabel,
}) {
  const row = await getConnection(tenantId);
  if (!row) {
    throw Object.assign(new Error('ALLDATA is not connected'), { statusCode: 400, isOperational: true });
  }

  const sets = ['updated_at = NOW()'];
  const params = [tenantId];
  let idx = 2;

  if (syncEnabled !== undefined) {
    sets.push(`sync_enabled = $${idx++}`);
    params.push(!!syncEnabled);
  }
  if (deferredFollowupEnabled !== undefined) {
    sets.push(`deferred_followup_enabled = $${idx++}`);
    params.push(!!deferredFollowupEnabled);
  }
  if (deferredFollowupSchedule !== undefined) {
    sets.push(`deferred_followup_schedule = $${idx++}::jsonb`);
    params.push(JSON.stringify(alldataDeferredService.normalizeFollowupSchedule(deferredFollowupSchedule)));
  }
  if (shopLabel !== undefined) {
    sets.push(`shop_label = $${idx++}`);
    params.push(shopLabel || null);
  }

  await db.query(
    `UPDATE tenant_alldata_connections SET ${sets.join(', ')} WHERE tenant_id = $1`,
    params,
  );

  return getStatus(tenantId);
}

function buildSftpConfig(row, overrides = {}) {
  const password = overrides.sftpPassword
    ?? (row?.sftp_password_enc ? decrypt(row.sftp_password_enc) : null);
  const privateKey = overrides.sftpPrivateKey
    ?? (row?.sftp_private_key_enc ? decrypt(row.sftp_private_key_enc) : null);

  const config = {
    host: overrides.sftpHost || row.sftp_host,
    port: Number(overrides.sftpPort || row.sftp_port || 22),
    username: overrides.sftpUsername || row.sftp_username,
    readyTimeout: 20000,
  };

  if (privateKey) {
    config.privateKey = privateKey;
  } else if (password) {
    config.password = password;
  }
  return config;
}

async function withSftp(row, overrides, fn) {
  const client = new SftpClient();
  try {
    await client.connect(buildSftpConfig(row, overrides));
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function testSftpCredentials(credentials) {
  const fakeRow = {
    sftp_host: credentials.sftpHost,
    sftp_port: credentials.sftpPort,
    sftp_username: credentials.sftpUsername,
    sftp_password_enc: credentials.sftpPassword ? encrypt(credentials.sftpPassword) : null,
    sftp_private_key_enc: credentials.sftpPrivateKey ? encrypt(credentials.sftpPrivateKey) : null,
    remote_path: credentials.remotePath || '/',
  };

  await withSftp(fakeRow, credentials, async (client) => {
    const remotePath = credentials.remotePath || '/';
    await client.list(remotePath);
  });

  return { ok: true };
}

async function testConnection(tenantId) {
  const row = await getConnection(tenantId);
  if (!row) {
    throw Object.assign(new Error('ALLDATA is not connected'), { statusCode: 400, isOperational: true });
  }
  const listing = await withSftp(row, {}, async (client) => client.list(row.remote_path || '/'));
  return { ok: true, fileCount: listing.length };
}

async function findContactByAlldataId(tenantId, alldataCustomerId) {
  if (!alldataCustomerId) return null;
  const result = await db.query(
    'SELECT id FROM contacts WHERE tenant_id = $1 AND alldata_customer_id = $2',
    [tenantId, alldataCustomerId],
  );
  return result.rows[0]?.id || null;
}

async function upsertContactFromAlldata(tenantId, customer) {
  if (!customer?.alldataCustomerId) return null;

  const phone = customer.phone ? normalizePhone(customer.phone) : null;
  const existingId = await findContactByAlldataId(tenantId, customer.alldataCustomerId);

  if (existingId) {
    await db.query(
      `UPDATE contacts SET
         first_name = COALESCE(NULLIF($2, ''), first_name),
         last_name = COALESCE(NULLIF($3, ''), last_name),
         email = COALESCE(NULLIF($4, ''), email),
         phone = COALESCE(NULLIF($5, ''), phone),
         source = CASE WHEN source = 'import' THEN 'alldata' ELSE source END,
         updated_at = NOW()
       WHERE id = $1`,
      [
        existingId,
        customer.firstName || '',
        customer.lastName || '',
        customer.email || '',
        phone || '',
      ],
    );
    return existingId;
  }

  if (!phone && !customer.email) return null;

  const contactId = await appointmentService.upsertContact(tenantId, {
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
  }, 'alldata');

  await db.query(
    'UPDATE contacts SET alldata_customer_id = $2, updated_at = NOW() WHERE id = $1',
    [contactId, customer.alldataCustomerId],
  );

  return contactId;
}

async function isFileProcessed(tenantId, fingerprint) {
  const result = await db.query(
    'SELECT id FROM alldata_import_files WHERE tenant_id = $1 AND file_fingerprint = $2',
    [tenantId, fingerprint],
  );
  return !!result.rows[0];
}

async function markFileProcessed(tenantId, fileName, fingerprint, kind, rowCount) {
  await db.query(
    `INSERT INTO alldata_import_files (tenant_id, file_name, file_fingerprint, file_kind, row_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, file_fingerprint) DO UPDATE SET
       processed_at = NOW(),
       row_count = EXCLUDED.row_count`,
    [tenantId, fileName, fingerprint, kind, rowCount || null],
  );
}

function vehicleLabelFor(vehicleMap, customerId, vehicleId) {
  if (!customerId) return null;
  if (vehicleId && vehicleMap.byVehicleId.has(vehicleId)) {
    return vehicleMap.byVehicleId.get(vehicleId);
  }
  if (vehicleMap.byCustomerId.has(customerId)) {
    return vehicleMap.byCustomerId.get(customerId);
  }
  return null;
}

function buildVehicleMaps(vehicles) {
  const byVehicleId = new Map();
  const byCustomerId = new Map();
  for (const v of vehicles) {
    if (v.alldataVehicleId) byVehicleId.set(v.alldataVehicleId, v.vehicleLabel);
    if (v.vehicleLabel && !byCustomerId.has(v.alldataCustomerId)) {
      byCustomerId.set(v.alldataCustomerId, v.vehicleLabel);
    }
  }
  return { byVehicleId, byCustomerId };
}

async function upsertCompletedRepairOrder(tenantId, order, vehicleLabel, dispatchAutomations, contactCache) {
  const contactId = contactCache?.get(order.alldataCustomerId)
    ?? await findContactByAlldataId(tenantId, order.alldataCustomerId);

  if (!contactId) {
    return { action: 'order_skipped', reason: 'no_contact', orderId: order.alldataRepairOrderId };
  }

  if (order.completedAt) {
    const when = new Date(order.completedAt);
    if (!Number.isNaN(when.getTime())) {
      await db.query(
        `UPDATE contacts
         SET last_visit_at = GREATEST(COALESCE(last_visit_at, $3), $3), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [contactId, tenantId, when],
      );
    }
  }

  const existingAppt = await db.query(
    `SELECT id FROM appointments
     WHERE tenant_id = $1 AND external_id = $2`,
    [tenantId, order.externalId],
  );

  let appointmentId = existingAppt.rows[0]?.id || null;
  let isNewCompletion = false;

  if (!appointmentId) {
    const contactRow = await db.query(
      'SELECT first_name, last_name, phone, email FROM contacts WHERE id = $1',
      [contactId],
    );
    const c = contactRow.rows[0] || {};

    const result = await appointmentService.processBookingEvent(tenantId, {
      eventType: 'booking.created',
      contact: {
        firstName: c.first_name,
        lastName: c.last_name,
        phone: c.phone,
        email: c.email,
      },
      appointment: {
        externalId: order.externalId,
        provider: 'alldata',
        scheduledAt: order.completedAt || new Date().toISOString(),
        serviceName: order.serviceName,
        rawPayload: {
          ...order.rawPayload,
          alldataVehicleLabel: vehicleLabel,
          alldataRepairOrderId: order.alldataRepairOrderId,
          alldataServices: order.performedServices,
        },
      },
      contactSource: 'alldata',
      existingContactId: contactId,
    });

    appointmentId = result.appointmentId;
    isNewCompletion = true;

    await db.query(
      `UPDATE appointments SET status = 'completed',
         completed_at = COALESCE(completed_at, $3), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [appointmentId, tenantId, order.completedAt || new Date().toISOString()],
    );
  }

  let postService = { jobsScheduled: 0 };
  let maintenance = { scheduled: false };
  let deferred = { action: 'deferred_skipped' };

  if (dispatchAutomations && isNewCompletion) {
    const tenantName = await getTenantName(tenantId);

    const classification = await autoShopClassification.classifyVisitServices(tenantId, {
      tenantName,
      appointmentId,
      contactId,
      orderId: order.alldataRepairOrderId,
      services: (order.performedServices || []).map((s) => ({
        id: s.id,
        name: s.name,
        authorizationStatus: 'authorized',
        completed: true,
      })),
    });

    postService = await appointmentWorkflowService.dispatchPostServiceCompletionWorkflows(tenantId, {
      contactId,
      appointmentId,
      checkedOutAt: order.completedAt,
      primaryServiceName: order.serviceName,
    });

    maintenance = await autoShopMaintenance.scheduleMaintenanceReminders({
      tenantId,
      tenantName,
      contactId,
      appointmentId,
      orderId: order.alldataRepairOrderId,
      classifications: classification.services || [],
      referenceAt: order.completedAt,
    });

    deferred = await alldataDeferredService.syncDeferredForCompletedOrder({
      tenantId,
      tenantName,
      contactId,
      customerId: order.alldataCustomerId,
      orderId: order.alldataRepairOrderId,
      appointmentId,
      completedAt: order.completedAt,
      vehicleLabel,
    });
  } else if (dispatchAutomations && appointmentId) {
    const tenantName = await getTenantName(tenantId);
    deferred = await alldataDeferredService.syncDeferredForCompletedOrder({
      tenantId,
      tenantName,
      contactId,
      customerId: order.alldataCustomerId,
      orderId: order.alldataRepairOrderId,
      appointmentId,
      completedAt: order.completedAt,
      vehicleLabel,
    });
  }

  return {
    action: isNewCompletion ? 'order_completed' : 'order_updated',
    contactId,
    appointmentId,
    orderId: order.alldataRepairOrderId,
    postService,
    maintenance,
    deferred,
  };
}

async function importDeferredFile(tenantId, buffer, vehicleMap, contactCache) {
  const items = normalizeDeferredList(buffer);
  let upserted = 0;

  for (const item of items) {
    let contactId = contactCache.get(item.alldataCustomerId);
    if (!contactId) {
      contactId = await findContactByAlldataId(tenantId, item.alldataCustomerId);
      if (!contactId) {
        contactId = await upsertContactFromAlldata(tenantId, {
          alldataCustomerId: item.alldataCustomerId,
        });
      }
      if (contactId) contactCache.set(item.alldataCustomerId, contactId);
    }
    if (!contactId) continue;

    const vehicleLabel = vehicleLabelFor(
      vehicleMap,
      item.alldataCustomerId,
      item.alldataVehicleId,
    );

    await alldataDeferredService.upsertDeferredServiceRow({
      tenantId,
      contactId,
      appointmentId: null,
      customerId: item.alldataCustomerId,
      item,
      vehicleLabel,
    });
    upserted += 1;
  }

  return { deferredRows: items.length, upserted };
}

async function processImportBuffers(tenantId, filesByKind) {
  const stats = {
    customers: 0,
    vehicles: 0,
    deferredRows: 0,
    orders: 0,
    ordersCompleted: 0,
  };

  const automationGate = await getTenantAutomationGate(tenantId);
  const contactCache = new Map();

  const customers = filesByKind.customers
    ? normalizeCustomerList(filesByKind.customers)
    : [];
  for (const customer of customers) {
    const contactId = await upsertContactFromAlldata(tenantId, customer);
    if (contactId) {
      contactCache.set(customer.alldataCustomerId, contactId);
      stats.customers += 1;
    }
  }

  const vehicles = filesByKind.vehicles ? normalizeVehicleList(filesByKind.vehicles) : [];
  stats.vehicles = vehicles.length;
  const vehicleMap = buildVehicleMaps(vehicles);

  if (filesByKind.deferred_work) {
    const deferred = await importDeferredFile(
      tenantId,
      filesByKind.deferred_work,
      vehicleMap,
      contactCache,
    );
    stats.deferredRows = deferred.upserted;
  }

  const orders = filesByKind.repair_orders ? groupRepairOrders(filesByKind.repair_orders) : [];
  stats.orders = orders.length;

  for (const order of orders) {
    if (!order.completedAt) continue;
    const vehicleLabel = vehicleLabelFor(
      vehicleMap,
      order.alldataCustomerId,
      order.alldataVehicleId,
    );
    const dispatchAutomations = shouldDispatchAutomations(automationGate, order.completedAt);
    const result = await upsertCompletedRepairOrder(
      tenantId,
      order,
      vehicleLabel,
      dispatchAutomations,
      contactCache,
    );
    if (result.action === 'order_completed') stats.ordersCompleted += 1;
  }

  return stats;
}

async function processManualBuffers(tenantId, buffers) {
  const filesByKind = {};
  for (const { kind, buffer } of buffers) {
    if (!kind || !buffer) continue;
    filesByKind[kind] = buffer;
  }
  return processImportBuffers(tenantId, filesByKind);
}

async function syncTenantFromSftp(tenantId) {
  const row = await getConnection(tenantId);
  if (!row?.sftp_host) {
    return { skipped: true, reason: 'not_connected' };
  }
  if (row.sync_enabled === false) {
    return { skipped: true, reason: 'sync_disabled' };
  }

  const tenantName = await getTenantName(tenantId);
  if (!isAlldataTenant(tenantId, tenantName)) {
    return { skipped: true, reason: 'not_alldata_tenant' };
  }

  const filesByKind = {};
  const processedFiles = [];
  const remotePath = row.remote_path || '/';

  try {
    await withSftp(row, {}, async (client) => {
      const listing = await client.list(remotePath);
      const csvFiles = listing.filter((f) => /\.csv$/i.test(f.name) && f.type !== 'd');

      for (const file of csvFiles) {
        const kind = classifyExportFile(file.name);
        if (!kind) continue;

        const basePath = (remotePath || '/').replace(/\/?$/, '') || '';
        const remoteFile = basePath ? `${basePath}/${file.name}` : file.name;
        const buffer = await client.get(remoteFile);
        const fp = fileFingerprint(file.name, buffer, file.modifyTime);
        if (await isFileProcessed(tenantId, fp)) continue;

        filesByKind[kind] = buffer;
        processedFiles.push({ name: file.name, kind, fingerprint: fp, buffer });
      }
    });

    if (processedFiles.length === 0) {
      await db.query(
        `UPDATE tenant_alldata_connections SET last_sync_at = NOW(), last_sync_error = NULL, updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId],
      );
      return { skipped: false, filesProcessed: 0, stats: null };
    }

    const batchByKind = {};
    for (const file of processedFiles) {
      batchByKind[file.kind] = file.buffer;
    }

    const stats = await processImportBuffers(tenantId, batchByKind);

    for (const file of processedFiles) {
      const rowCount = file.kind === 'repair_orders'
        ? groupRepairOrders(file.buffer).length
        : null;
      await markFileProcessed(tenantId, file.name, file.fingerprint, file.kind, rowCount);
    }

    await db.query(
      `UPDATE tenant_alldata_connections
       SET last_sync_at = NOW(), last_sync_error = NULL,
           last_sync_stats = $2::jsonb, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, JSON.stringify({ ...stats, filesProcessed: processedFiles.length })],
    );

    return { skipped: false, filesProcessed: processedFiles.length, stats };
  } catch (err) {
    await db.query(
      `UPDATE tenant_alldata_connections SET last_sync_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, err.message],
    );
    throw err;
  }
}

async function listSyncConnections() {
  const result = await db.query(
    `SELECT c.*, t.name AS tenant_name
     FROM tenant_alldata_connections c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.sync_enabled = true
       AND c.sftp_host IS NOT NULL
       AND c.sftp_username IS NOT NULL`,
  );

  return result.rows.filter((row) => isAlldataTenant(row.tenant_id, row.tenant_name));
}

module.exports = {
  formatConnection,
  getStatus,
  connect,
  disconnect,
  updateSettings,
  testConnection,
  syncTenantFromSftp,
  processManualBuffers,
  listSyncConnections,
  upsertContactFromAlldata,
};
