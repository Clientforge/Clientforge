const express = require('express');
const router = express.Router();
const conversationService = require('../services/conversation.service');

/**
 * GET /api/v1/conversations — List all conversations for the tenant.
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await conversationService.listConversations(req.tenantId, {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 25, 100),
      search: search || undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/conversations/:participantType/:participantId — Get a single conversation thread.
 */
router.get('/:participantType/:participantId', async (req, res, next) => {
  try {
    const { participantType, participantId } = req.params;
    const result = await conversationService.getConversation(
      req.tenantId,
      participantType,
      participantId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/conversations/:participantType/:participantId/messages — Send a manual reply.
 */
router.post('/:participantType/:participantId/messages', async (req, res, next) => {
  try {
    const { participantType, participantId } = req.params;
    const { body } = req.body;

    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    const message = await conversationService.sendManualReply(
      req.tenantId,
      participantType,
      participantId,
      body,
    );
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/conversations/:participantType/:participantId/ai-reply
 * Body: { aiAutoReplyOverride: true | false | null } — null = use tenant default
 */
router.patch('/:participantType/:participantId/ai-reply', async (req, res, next) => {
  try {
    const { participantType, participantId } = req.params;
    const { aiAutoReplyOverride } = req.body;
    if (
      aiAutoReplyOverride !== null
      && aiAutoReplyOverride !== undefined
      && typeof aiAutoReplyOverride !== 'boolean'
    ) {
      return res.status(400).json({ error: 'aiAutoReplyOverride must be true, false, or null' });
    }
    const updated = await conversationService.updateAiReplyOverride(
      req.tenantId,
      participantType,
      participantId,
      aiAutoReplyOverride === undefined ? null : aiAutoReplyOverride,
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
