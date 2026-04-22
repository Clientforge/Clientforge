/**
 * Alpha Vantage — metal / industrial commodity proxies (ETFs, not spot steel $/lb).
 * SLX ≈ steel, DBB ≈ industrial metals basket, CPER ≈ copper.
 *
 * Free tier: low daily quota — use 24h cache and ~1.2s between symbol requests.
 * https://www.alphavantage.co/support/#api-key
 */

'use strict';

const AV_BASE = 'https://www.alphavantage.co/query';

const METAL_ETFS = [
  { key: 'steel', symbol: 'SLX', label: 'Steel proxy (SLX)' },
  { key: 'aluminum', symbol: 'DBB', label: 'Industrial metals (DBB)' },
  { key: 'copper', symbol: 'CPER', label: 'Copper (CPER)' },
];

const CACHE_OK_MS = 24 * 60 * 60 * 1000;
const CACHE_FAIL_MS = 60 * 60 * 1000;

let cache = {
  expiresAt: 0,
  payload: null,
};

function parseTimeSeriesClose(json) {
  if (!json || json.Note || json.Information) return null;
  const series = json['Time Series (Daily)'];
  if (!series || typeof series !== 'object') return null;
  const dates = Object.keys(series).sort().reverse();
  const closes = [];
  for (let i = 0; i < Math.min(20, dates.length); i += 1) {
    const row = series[dates[i]];
    const c = parseFloat(row && row['4. close']);
    if (!Number.isNaN(c)) closes.push(c);
  }
  if (closes.length < 5) return null;
  const latest = closes[0];
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  if (mean === 0) return null;
  return { latest, mean, ratio: latest / mean };
}

async function fetchDailySeries(symbol, apiKey) {
  const params = new URLSearchParams({
    function: 'TIME_SERIES_DAILY',
    symbol,
    outputsize: 'compact',
    apikey: apiKey,
  });
  const r = await fetch(`${AV_BASE}?${params.toString()}`);
  if (!r.ok) return null;
  return r.json();
}

/**
 * @returns {Promise<{ blendMultiplier: number, status: string, symbols: object, fetchedAt?: string, detail?: string }>}
 */
async function getMetalCommodityBlend() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey || String(apiKey).trim() === '') {
    return {
      blendMultiplier: 1,
      status: 'disabled',
      detail: 'Set ALPHA_VANTAGE_API_KEY to enable ETF-based metal proxy.',
      symbols: {},
    };
  }

  const now = Date.now();
  if (cache.payload && cache.expiresAt > now) {
    return { ...cache.payload, status: 'cached' };
  }

  const symbols = {};
  const factors = [];
  let hadError = false;

  for (let i = 0; i < METAL_ETFS.length; i += 1) {
    const { key, symbol, label } = METAL_ETFS[i];
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    try {
      const json = await fetchDailySeries(symbol, apiKey.trim());
      const parsed = parseTimeSeriesClose(json);
      if (!parsed) {
        hadError = true;
        symbols[key] = { symbol, label, error: 'no_data_or_rate_limit' };
        continue;
      }
      const factor = Math.max(0.94, Math.min(1.06, parsed.ratio));
      symbols[key] = {
        symbol,
        label,
        latest: Number(parsed.latest.toFixed(4)),
        mean20d: Number(parsed.mean.toFixed(4)),
        ratio: Number(parsed.ratio.toFixed(4)),
        factor: Number(factor.toFixed(4)),
      };
      factors.push(factor);
    } catch (e) {
      hadError = true;
      symbols[key] = { symbol, label, error: String(e.message || e) };
    }
  }

  let blendMultiplier = 1;
  if (factors.length > 0) {
    blendMultiplier = factors.reduce((a, b) => a + b, 0) / factors.length;
    blendMultiplier = Math.max(0.9, Math.min(1.1, blendMultiplier));
  }

  const status = factors.length === 0 ? 'error' : hadError ? 'partial' : 'live';
  const fetchedAt = new Date().toISOString();

  const payload = {
    blendMultiplier,
    status,
    symbols,
    fetchedAt,
  };

  const ttl = factors.length > 0 ? CACHE_OK_MS : CACHE_FAIL_MS;
  cache = { expiresAt: now + ttl, payload: { ...payload } };

  return payload;
}

module.exports = {
  getMetalCommodityBlend,
  METAL_ETFS,
};
