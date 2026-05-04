const express = require('express');
const { computeGraceEstimate } = require('../services/gracePricingV1.service');
const {
  processSellIntent,
  SellIntentError,
} = require('../services/graceSellIntent.service');

const router = express.Router();

/** Simple per-IP cap for unauthenticated sell-intent POSTs (best-effort; resets hourly). */
const sellIntentLimiter = (() => {
  const hits = new Map();
  const WINDOW_MS = 60 * 60 * 1000;
  const MAX = 15;
  return (req, res, next) => {
    const fwd = req.headers['x-forwarded-for'];
    const ip =
      (typeof fwd === 'string' ? fwd.split(',')[0].trim() : null) ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    let row = hits.get(ip);
    if (!row || now > row.resetAt) {
      row = { n: 0, resetAt: now + WINDOW_MS };
      hits.set(ip, row);
    }
    if (row.n >= MAX) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(429).json({ error: 'Too many submissions. Try again later.' });
    }
    row.n += 1;
    next();
  };
})();

/** NHTSA vPIC does not send Access-Control-Allow-Origin; browsers need this proxy. */
router.get('/vin-decode/:vin', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const raw = String(req.params.vin || '').trim().toUpperCase().replace(/\s/g, '');
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(raw)) {
    return res.status(400).json({ error: 'Invalid VIN (must be 17 characters, no I, O, or Q).' });
  }
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(raw)}?format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ error: 'VIN service returned an error.' });
    }
    const data = await r.json();
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach VIN service.' });
  }
});

/** Grace to Grace v1 estimate (title + scrap + optional Alpha Vantage metal ETFs + market proxy). Public, no auth. */
router.post('/grace-estimate', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const out = await computeGraceEstimate(req.body);
    return res.json(out);
  } catch (err) {
    const msg = err.message || 'Estimate failed.';
    return res.status(400).json({ error: msg });
  }
});

/**
 * Grace to Grace — customer tapped "Sell now" on estimate; SMS staff at G2G_SELL_NOTIFY_PHONE.
 */
router.post('/grace-sell-intent', sellIntentLimiter, async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    await processSellIntent(req.body);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof SellIntentError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[public/grace-sell-intent]', err);
    return res.status(500).json({ error: 'Could not send notification.' });
  }
});

module.exports = router;
