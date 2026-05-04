const express = require('express');
const crypto = require('crypto');
const { computeGraceEstimate } = require('../services/gracePricingV1.service');
const {
  processSellIntent,
  SellIntentError,
} = require('../services/graceSellIntent.service');
const {
  recordGraceEstimateSnapshot,
  getG2gEstimateSnapshots,
} = require('../services/graceEstimateSnapshot.service');

const router = express.Router();

function reportKeyMatches(provided, expected) {
  if (provided == null || expected == null) return false;
  const p = String(provided);
  const e = String(expected).trim();
  if (!e || p.length !== e.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(p, 'utf8'), Buffer.from(e, 'utf8'));
  } catch {
    return false;
  }
}

function validateClientEstimateSnapshot(body) {
  if (!body || typeof body !== 'object') {
    const e = new Error('Invalid body.');
    e.status = 400;
    throw e;
  }
  const inp = body.input;
  const out = body.result;
  if (!inp || typeof inp !== 'object' || !out || typeof out !== 'object') {
    const e = new Error('input and result objects are required.');
    e.status = 400;
    throw e;
  }
  const low = Number(out.low);
  const high = Number(out.high);
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    const e = new Error('result.low and result.high must be numbers.');
    e.status = 400;
    throw e;
  }
  const year = String(inp.year || '').trim();
  const make = String(inp.make || '').trim();
  const model = String(inp.model || '').trim();
  const z = String(inp.zip || '').replace(/\D/g, '');
  if (!year || !make || !model || z.length < 5) {
    const e = new Error('input year, make, model, and zip are required.');
    e.status = 400;
    throw e;
  }
}

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

/** Browser-only estimate (local v0 engine) — log same funnel table. */
const estimateSnapshotLimiter = (() => {
  const hits = new Map();
  const WINDOW_MS = 60 * 60 * 1000;
  const MAX = 40;
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
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    row.n += 1;
    next();
  };
})();

/** Optional bookmarkable report: GET + ?key= matches G2G_SNAPSHOTS_REPORT_KEY */
const snapshotReportLimiter = (() => {
  const hits = new Map();
  const WINDOW_MS = 60 * 60 * 1000;
  const MAX = 120;
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
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
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
    const logInput = { ...req.body };
    const sessionId =
      logInput.sessionId != null ? String(logInput.sessionId).slice(0, 80) : null;
    delete logInput.sessionId;
    recordGraceEstimateSnapshot({
      source: 'api_grace_estimate',
      sessionId,
      input: logInput,
      result: out,
    }).catch((e) => console.error('[g2g-estimate-snapshot]', e.message));
    return res.json(out);
  } catch (err) {
    const msg = err.message || 'Estimate failed.';
    return res.status(400).json({ error: msg });
  }
});

/**
 * Standalone G2G site (local pricing engine) — record estimate view for funnel analytics.
 */
router.post('/grace-estimate-snapshot', estimateSnapshotLimiter, async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    validateClientEstimateSnapshot(req.body);
    const sessionId =
      req.body.sessionId != null ? String(req.body.sessionId).slice(0, 80) : null;
    await recordGraceEstimateSnapshot({
      source: 'client_local_engine',
      sessionId,
      input: req.body.input,
      result: req.body.result,
    });
    return res.json({ ok: true });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[public/grace-estimate-snapshot]', err);
    return res.status(500).json({ error: 'Could not save snapshot.' });
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

/**
 * Bookmarkable JSON export of g2g_estimate_snapshots — no JWT.
 * Set G2G_SNAPSHOTS_REPORT_KEY (long random string). If unset, route returns 404.
 * Example: GET .../public/g2g-estimate-snapshots-report?key=YOUR_SECRET&page=1&limit=50
 */
router.get('/g2g-estimate-snapshots-report', snapshotReportLimiter, async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const expected = process.env.G2G_SNAPSHOTS_REPORT_KEY;
  if (!expected || !String(expected).trim()) {
    return res.status(404).json({ error: 'Not found.' });
  }
  const key = req.query.key;
  if (!reportKeyMatches(key, expected)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  try {
    const result = await getG2gEstimateSnapshots({
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (err) {
    console.error('[public/g2g-estimate-snapshots-report]', err);
    return res.status(500).json({ error: 'Could not load data.' });
  }
});

module.exports = router;
