const express = require('express');
const authenticateAmy = require('../middleware/amyAuth');
const amyAuthService = require('../services/amyAuth.service');
const amyService = require('../services/amy.service');

const router = express.Router();

router.post('/auth/login', async (req, res, next) => {
  try {
    const result = await amyAuthService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.use(authenticateAmy);

router.get('/auth/me', (req, res) => {
  res.json({ ok: true });
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await amyService.getDashboardStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/clients', async (req, res, next) => {
  try {
    if (req.query.simple === 'true') {
      const clients = await amyService.getAllClientsSimple();
      return res.json(clients);
    }
    const clients = await amyService.getClientsWithStats();
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

router.post('/clients', async (req, res, next) => {
  try {
    const client = await amyService.createClient(req.body);
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

router.get('/clients/:id', async (req, res, next) => {
  try {
    const client = await amyService.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.put('/clients/:id', async (req, res, next) => {
  try {
    const client = await amyService.updateClient(req.params.id, req.body);
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.delete('/clients/:id', async (req, res, next) => {
  try {
    await amyService.deleteClient(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', async (req, res, next) => {
  try {
    const sessions = await amyService.getSessions({
      clientId: req.query.clientId,
      serviceType: req.query.serviceType,
      limit: req.query.limit,
    });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const session = await amyService.createSession(req.body);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    await amyService.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/rbt', async (req, res, next) => {
  try {
    if (req.query.simple === 'true') {
      const rbts = await amyService.getAllRbtsSimple();
      return res.json(rbts);
    }
    const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month, 10) : undefined;
    const rbts = await amyService.getRbtsWithStats(year, month);
    res.json(rbts);
  } catch (err) {
    next(err);
  }
});

router.post('/rbt', async (req, res, next) => {
  try {
    const rbt = await amyService.createRbt(req.body);
    res.status(201).json(rbt);
  } catch (err) {
    next(err);
  }
});

router.get('/rbt/:id', async (req, res, next) => {
  try {
    const rbt = await amyService.getRbtById(req.params.id);
    if (!rbt) return res.status(404).json({ error: 'Not found' });
    res.json(rbt);
  } catch (err) {
    next(err);
  }
});

router.put('/rbt/:id', async (req, res, next) => {
  try {
    const rbt = await amyService.updateRbt(req.params.id, req.body);
    res.json(rbt);
  } catch (err) {
    next(err);
  }
});

router.get('/notes', async (req, res, next) => {
  try {
    const notes = await amyService.getCaseNotes({
      clientId: req.query.clientId,
      search: req.query.search,
    });
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

router.post('/notes', async (req, res, next) => {
  try {
    const note = await amyService.createCaseNote(req.body);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
