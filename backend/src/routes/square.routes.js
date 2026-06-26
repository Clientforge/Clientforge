const express = require('express');
const router = express.Router();
const squareService = require('../services/square.service');

router.get('/status', async (req, res, next) => {
  try {
    const status = await squareService.getStatus(req.tenantId);
    res.json(status || { connected: false, configured: squareService.isConfigured() });
  } catch (err) {
    next(err);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    const url = squareService.buildConnectUrl(req.tenantId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    const result = await squareService.disconnect(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const { webhooksEnabled } = req.body || {};
    if (webhooksEnabled !== undefined) {
      const status = await squareService.setWebhooksEnabled(req.tenantId, webhooksEnabled);
      return res.json(status);
    }
    const status = await squareService.getStatus(req.tenantId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
