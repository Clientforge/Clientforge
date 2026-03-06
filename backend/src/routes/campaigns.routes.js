const express = require('express');
const router = express.Router();
const campaignService = require('../services/campaign.service');
const aiService = require('../services/ai.service');

router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await campaignService.listCampaigns(req.tenantId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await campaignService.getCampaignStats(req.tenantId);
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await campaignService.listTemplates(req.tenantId);
    res.json({ templates });
  } catch (err) { next(err); }
});

router.post('/from/:id', async (req, res, next) => {
  try {
    const campaign = await campaignService.cloneCampaign(req.tenantId, req.params.id);
    res.status(201).json(campaign);
  } catch (err) { next(err); }
});

router.post('/from-template/:templateId', async (req, res, next) => {
  try {
    const campaign = await campaignService.createCampaignFromTemplate(
      req.tenantId,
      req.params.templateId,
      req.body,
    );
    res.status(201).json(campaign);
  } catch (err) { next(err); }
});

router.post('/templates', async (req, res, next) => {
  try {
    const template = await campaignService.createTemplate(req.tenantId, req.body);
    res.status(201).json(template);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await campaignService.getCampaign(req.tenantId, req.params.id);
    res.json(campaign);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const campaign = await campaignService.createCampaign(req.tenantId, req.body);
    res.status(201).json(campaign);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const campaign = await campaignService.updateCampaign(req.tenantId, req.params.id, req.body);
    res.json(campaign);
  } catch (err) { next(err); }
});

router.post('/:id/launch', async (req, res, next) => {
  try {
    const result = await campaignService.launchCampaign(req.tenantId, req.params.id);
    res.json({ message: 'Campaign launched', ...result });
  } catch (err) { next(err); }
});

router.post('/generate-sequence', async (req, res, next) => {
  try {
    const { campaignName, promotionDetails, audienceDescription, waveCount, channel } = req.body;
    const sequence = await aiService.generateCampaignSequence(req.tenantId, {
      campaignName,
      promotionDetails,
      audienceDescription,
      waveCount: parseInt(waveCount) || 4,
      channel: channel || 'sms',
    });
    res.json({ sequence });
  } catch (err) { next(err); }
});

module.exports = router;
