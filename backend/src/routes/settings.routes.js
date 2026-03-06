const express = require('express');
const router = express.Router();
const settingsService = require('../services/settings.service');
const aiService = require('../services/ai.service');

router.get('/', async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings(req.tenantId);
    res.json(settings);
  } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
  try {
    const updated = await settingsService.updateSettings(req.tenantId, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/regenerate-api-key', async (req, res, next) => {
  try {
    const result = await settingsService.regenerateApiKey(req.tenantId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/generate-followups', async (req, res, next) => {
  try {
    const schedule = await aiService.generateFollowUpSchedule(req.tenantId);
    res.json({ schedule });
  } catch (err) { next(err); }
});

router.post('/refine-followups', async (req, res, next) => {
  try {
    const { currentSchedule, instruction } = req.body;
    if (!instruction) {
      return res.status(400).json({ error: 'instruction is required' });
    }
    const schedule = await aiService.refineFollowUpMessages(req.tenantId, currentSchedule || [], instruction);
    res.json({ schedule });
  } catch (err) { next(err); }
});

module.exports = router;
