const express = require('express');
const router = express.Router();
const shopmonkeyService = require('../services/shopmonkey.service');
const shopmonkeyDeferredService = require('../services/shopmonkey-deferred.service');
const { isShopmonkeyTenant } = require('../config/shopmonkeyTenant');
const db = require('../db/connection');

async function assertShopmonkeyTenant(req, res, next) {
  try {
    const tenantRow = await db.query('SELECT name FROM tenants WHERE id = $1', [req.tenantId]);
    const name = tenantRow.rows[0]?.name;
    const connected = await shopmonkeyService.getStatus(req.tenantId);
    if (!isShopmonkeyTenant(req.tenantId, name) && !connected.connected) {
      return res.status(403).json({ error: 'Shopmonkey integration is not enabled for this account' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

router.use(assertShopmonkeyTenant);

router.get('/status', async (req, res, next) => {
  try {
    const status = await shopmonkeyService.getStatus(req.tenantId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    const { apiKey, locationId, webhookSecret, shopName } = req.body || {};
    const status = await shopmonkeyService.connect(req.tenantId, {
      apiKey,
      locationId,
      webhookSecret,
      shopName,
    });
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    const result = await shopmonkeyService.disconnect(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/test', async (req, res, next) => {
  try {
    const result = await shopmonkeyService.testConnection(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh-service-names', async (req, res, next) => {
  try {
    const result = await shopmonkeyService.refreshAppointmentServiceNames(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/deferred-services/summary', async (req, res, next) => {
  try {
    const summary = await shopmonkeyDeferredService.getDeferredSummary(req.tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/deferred-services', async (req, res, next) => {
  try {
    const { contactId, status, page, limit } = req.query || {};
    const result = await shopmonkeyDeferredService.listDeferredServices(req.tenantId, {
      contactId: contactId || undefined,
      status: status || undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const {
      webhooksEnabled,
      webhookSecret,
      locationId,
      deferredFollowupEnabled,
    } = req.body || {};
    const status = await shopmonkeyService.updateSettings(req.tenantId, {
      webhooksEnabled,
      webhookSecret,
      locationId,
      deferredFollowupEnabled,
    });
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
