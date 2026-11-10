const express = require('express');
const multer = require('multer');
const router = express.Router();
const db = require('../db/connection');
const alldataService = require('../services/alldata.service');
const { isAlldataTenant } = require('../config/alldataTenant');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function assertAlldataTenant(req, res, next) {
  try {
    const tenantRow = await db.query('SELECT name FROM tenants WHERE id = $1', [req.tenantId]);
    const name = tenantRow.rows[0]?.name;
    const status = await alldataService.getStatus(req.tenantId);
    if (!isAlldataTenant(req.tenantId, name) && !status.connected) {
      return res.status(403).json({ error: 'ALLDATA integration is not enabled for this account' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

router.use(assertAlldataTenant);

router.get('/status', async (req, res, next) => {
  try {
    res.json(await alldataService.getStatus(req.tenantId));
  } catch (err) {
    next(err);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    const {
      sftpHost,
      sftpPort,
      sftpUsername,
      sftpPassword,
      sftpPrivateKey,
      remotePath,
      shopLabel,
    } = req.body || {};
    const status = await alldataService.connect(req.tenantId, {
      sftpHost,
      sftpPort,
      sftpUsername,
      sftpPassword,
      sftpPrivateKey,
      remotePath,
      shopLabel,
    });
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    res.json(await alldataService.disconnect(req.tenantId));
  } catch (err) {
    next(err);
  }
});

router.post('/test', async (req, res, next) => {
  try {
    res.json(await alldataService.testConnection(req.tenantId));
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const { syncEnabled, deferredFollowupEnabled, deferredFollowupSchedule, shopLabel } = req.body || {};
    res.json(await alldataService.updateSettings(req.tenantId, {
      syncEnabled,
      deferredFollowupEnabled,
      deferredFollowupSchedule,
      shopLabel,
    }));
  } catch (err) {
    next(err);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const result = await alldataService.syncTenantFromSftp(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Manual CSV upload for connector testing (one file per kind).
 * Query: kind=customers|vehicles|repair_orders|deferred_work
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }
    const kind = String(req.query.kind || '').trim();
    const allowed = new Set(['customers', 'vehicles', 'repair_orders', 'deferred_work']);
    if (!allowed.has(kind)) {
      return res.status(400).json({ error: 'Invalid kind — use customers, vehicles, repair_orders, or deferred_work' });
    }

    const stats = await alldataService.processManualBuffers(req.tenantId, [{
      kind,
      buffer: req.file.buffer,
    }]);

    res.json({ kind, stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
