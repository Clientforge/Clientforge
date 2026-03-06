const express = require('express');
const router = express.Router();
const multer = require('multer');
const contactService = require('../services/contact.service');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, search, tag } = req.query;
    const result = await contactService.listContacts(req.tenantId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 25,
      search,
      tag,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await contactService.getContactStats(req.tenantId);
    res.json(stats);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const contact = await contactService.createContact(req.tenantId, req.body);
    res.status(201).json(contact);
  } catch (err) { next(err); }
});

router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    const result = await contactService.importFromCSV(
      req.tenantId,
      req.file.buffer,
      req.body.source || 'import',
    );
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
