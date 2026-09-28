/**
 * Per-IP rate limits for auth endpoints (in-memory; per server instance).
 */

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, label = 'auth' }) {
  const hits = new Map();

  return (req, res, next) => {
    const ip = clientIp(req);
    const now = Date.now();
    let row = hits.get(ip);
    if (!row || now > row.resetAt) {
      row = { n: 0, resetAt: now + windowMs };
      hits.set(ip, row);
    }
    if (row.n >= max) {
      res.setHeader('Retry-After', String(Math.ceil((row.resetAt - now) / 1000)));
      return res.status(429).json({
        error: 'Too many attempts. Please try again later.',
      });
    }
    row.n += 1;
    next();
  };
}

const FIFTEEN_MIN = 15 * 60 * 1000;

const loginLimiter = createRateLimiter({ windowMs: FIFTEEN_MIN, max: 20, label: 'login' });
const registerLimiter = createRateLimiter({ windowMs: FIFTEEN_MIN, max: 10, label: 'register' });
const refreshLimiter = createRateLimiter({ windowMs: FIFTEEN_MIN, max: 30, label: 'refresh' });

module.exports = {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
};
