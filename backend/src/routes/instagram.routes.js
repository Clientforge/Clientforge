const express = require('express');
const router = express.Router();
const instagramService = require('../services/instagram.service');

router.get('/status', async (req, res, next) => {
  try {
    const status = await instagramService.getStatus(req.tenantId);
    res.json(status || { connected: false, configured: instagramService.isConfigured() });
  } catch (err) {
    next(err);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    const url = instagramService.buildConnectUrl(req.tenantId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    const result = await instagramService.disconnect(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
