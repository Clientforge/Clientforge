const db = require('../db/connection');

const REVIEW_FLOW_ENV = {
  'bay-area-heart-review': 'BAY_AREA_HEART_TENANT_ID',
};

const MAX_COMMENT_LENGTH = 5000;
const MAX_CATEGORY_LEN = 120;
const ALLOWED_STARS = new Set([1, 2, 3]);

class PatientFeedbackError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function trimComment(value) {
  const t = String(value ?? '').trim();
  if (!t) return null;
  return t.length > MAX_COMMENT_LENGTH ? t.slice(0, MAX_COMMENT_LENGTH) : t;
}

function normalizeCategories(raw) {
  if (!Array.isArray(raw)) {
    throw new PatientFeedbackError('categories must be an array');
  }
  const list = raw
    .map((c) => String(c ?? '').trim())
    .filter(Boolean)
    .map((c) => (c.length > MAX_CATEGORY_LEN ? c.slice(0, MAX_CATEGORY_LEN) : c));
  if (list.length === 0) {
    throw new PatientFeedbackError('Select at least one area to improve');
  }
  return list;
}

async function resolveTenantForReviewFlow(reviewFlow) {
  const flow = String(reviewFlow || '').trim();
  if (!flow) {
    throw new PatientFeedbackError('reviewFlow is required');
  }

  const byColumn = await db.query(
    `SELECT id, name, timezone
     FROM tenants
     WHERE active = true
       AND patient_feedback_enabled = true
       AND patient_review_flow = $1
     LIMIT 1`,
    [flow],
  );
  if (byColumn.rows[0]) return byColumn.rows[0];

  const envKey = REVIEW_FLOW_ENV[flow];
  const tenantId = envKey ? (process.env[envKey] || '').trim() : '';
  if (tenantId) {
    const byEnv = await db.query(
      `SELECT id, name, timezone
       FROM tenants
       WHERE id = $1 AND active = true
       LIMIT 1`,
      [tenantId],
    );
    if (byEnv.rows[0]) return byEnv.rows[0];
  }

  throw new PatientFeedbackError('This feedback form is not configured', 503);
}

async function submitFeedback({ reviewFlow, stars, categories, comment }) {
  const tenant = await resolveTenantForReviewFlow(reviewFlow);

  const starNum = parseInt(stars, 10);
  if (!ALLOWED_STARS.has(starNum)) {
    throw new PatientFeedbackError('Rating must be 1, 2, or 3 stars');
  }

  const cats = normalizeCategories(categories);
  const commentText = trimComment(comment);

  const result = await db.query(
    `INSERT INTO patient_feedback
       (tenant_id, review_flow, stars, categories, comment, submitted_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, submitted_at`,
    [tenant.id, String(reviewFlow).trim(), starNum, JSON.stringify(cats), commentText],
  );

  return {
    id: result.rows[0].id,
    submittedAt: result.rows[0].submitted_at,
  };
}

async function assertFeedbackEnabled(tenantId) {
  const r = await db.query(
    'SELECT patient_feedback_enabled FROM tenants WHERE id = $1',
    [tenantId],
  );
  if (!r.rows[0]?.patient_feedback_enabled) {
    throw Object.assign(new Error('Patient feedback is not enabled for this account'), {
      statusCode: 403,
      isOperational: true,
    });
  }
}

async function listFeedback(tenantId, { page = 1, limit = 50 } = {}) {
  await assertFeedbackEnabled(tenantId);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const [countRes, dataRes] = await Promise.all([
    db.query(
      'SELECT COUNT(*)::int AS total FROM patient_feedback WHERE tenant_id = $1',
      [tenantId],
    ),
    db.query(
      `SELECT id, review_flow, stars, categories, comment, submitted_at
       FROM patient_feedback
       WHERE tenant_id = $1
       ORDER BY submitted_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, safeLimit, offset],
    ),
  ]);

  const total = countRes.rows[0]?.total ?? 0;
  return {
    feedback: dataRes.rows.map(formatRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

function formatRow(row) {
  let categories = row.categories;
  if (typeof categories === 'string') {
    try {
      categories = JSON.parse(categories);
    } catch {
      categories = [];
    }
  }
  if (!Array.isArray(categories)) categories = [];

  return {
    id: row.id,
    reviewFlow: row.review_flow,
    stars: row.stars,
    categories,
    comment: row.comment || null,
    submittedAt: row.submitted_at,
  };
}

module.exports = {
  PatientFeedbackError,
  submitFeedback,
  listFeedback,
};
