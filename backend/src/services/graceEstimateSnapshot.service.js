const db = require('../db/connection');

const PLATFORM_TENANT_ID = process.env.G2G_SELL_INTENT_TENANT_ID?.trim() || '00000000-0000-0000-0000-000000000001';

/**
 * Persist estimate funnel event (non-blocking for callers).
 */
const recordGraceEstimateSnapshot = async ({ source, sessionId, input, result }) => {
  const src = String(source || '').slice(0, 48);
  if (!src) return null;
  const sid = sessionId != null ? String(sessionId).slice(0, 80) : null;
  const inObj = input != null && typeof input === 'object' ? input : {};
  const outObj = result != null && typeof result === 'object' ? result : {};

  const r = await db.query(
    `INSERT INTO g2g_estimate_snapshots (tenant_id, source, session_id, input, result)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
     RETURNING id, created_at`,
    [PLATFORM_TENANT_ID, src, sid, JSON.stringify(inObj), JSON.stringify(outObj)],
  );
  return r.rows[0];
};

const getG2gEstimateSnapshots = async ({ page = 1, limit = 50 }) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const [countRes, rowsRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM g2g_estimate_snapshots`),
    db.query(
      `SELECT id, tenant_id, source, session_id, input, result, created_at
       FROM g2g_estimate_snapshots
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset],
    ),
  ]);

  return {
    data: rowsRes.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: countRes.rows[0].total,
      totalPages: Math.ceil(countRes.rows[0].total / safeLimit) || 1,
    },
  };
};

module.exports = {
  recordGraceEstimateSnapshot,
  getG2gEstimateSnapshots,
};
