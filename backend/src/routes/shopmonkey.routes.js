const express = require('express');
const router = express.Router();
const shopmonkeyService = require('../services/shopmonkey.service');
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

router.put('/', async (req, res, next) => {
  try {
    const { webhooksEnabled, webhookSecret, locationId } = req.body || {};
    const status = await shopmonkeyService.updateSettings(req.tenantId, {
      webhooksEnabled,
      webhookSecret,
      locationId,
    });
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
