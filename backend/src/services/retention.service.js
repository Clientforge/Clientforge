const db = require('../db/connection');
const {
  RETENTION_BUCKETS,
  SLUICE_SERVICE_CATEGORIES,
  getCategory,
  getBucket,
} = require('../config/sluiceRetentionCategories');

const isRetentionDashboardEnabled = async (tenantId) => {
  const result = await db.query(
    'SELECT retention_dashboard_enabled FROM tenants WHERE id = $1',
    [tenantId],
  );
  return !!result.rows[0]?.retention_dashboard_enabled;
};

const assertRetentionEnabled = async (tenantId) => {
  const enabled = await isRetentionDashboardEnabled(tenantId);
  if (!enabled) {
    throw Object.assign(new Error('Retention dashboard is not enabled for this account'), {
      statusCode: 403,
      isOperational: true,
    });
  }
};

function buildAppointmentPatternClause(alias, categoryKey, startIdx) {
  const cat = getCategory(categoryKey);
  if (cat.key === 'all') {
    return { clause: 'TRUE', params: [], nextIdx: startIdx };
  }

  const parts = [];
  const params = [];
  let idx = startIdx;

  for (const pattern of cat.appointmentPatterns) {
    parts.push(`${alias}.service_name ILIKE $${idx}`);
    params.push(`%${pattern}%`);
    idx += 1;
  }

  if (cat.key === 'iv-hydration') {
    parts.push(`${alias}.service_name NOT ILIKE $${idx}`);
    params.push('%premium drip%');
    idx += 1;
  }

  return {
    clause: parts.length > 0 ? `(${parts.join(' OR ')})` : 'FALSE',
    params,
    nextIdx: idx,
  };
}

function buildSegmentedContactsQuery(tenantId, categoryKey) {
  const cat = getCategory(categoryKey);
  const params = [tenantId];

  if (cat.key === 'all') {
    const sql = `
      WITH segmented AS (
        SELECT
          c.id,
          c.first_name,
          c.last_name,
          c.phone,
          c.email,
          c.tags,
          c.last_visit_at,
          COALESCE(
            (SELECT MAX(a.scheduled_at) FROM appointments a
             WHERE a.tenant_id = c.tenant_id AND a.contact_id = c.id
               AND a.status NOT IN ('cancelled')),
            c.last_visit_at
          ) AS effective_last_at
        FROM contacts c
        WHERE c.tenant_id = $1
          AND c.unsubscribed = false
          AND c.phone IS NOT NULL
      )
    `;
    return { sql, params };
  }

  params.push(cat.tagSlugs);
  const tagIdx = 2;
  const apptMatch = buildAppointmentPatternClause('a', categoryKey, 3);

  params.push(...apptMatch.params);

  const sql = `
    WITH segmented AS (
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        c.tags,
        c.last_visit_at,
        COALESCE(
          (SELECT MAX(a.scheduled_at) FROM appointments a
           WHERE a.tenant_id = c.tenant_id AND a.contact_id = c.id
             AND a.status NOT IN ('cancelled')
             AND ${apptMatch.clause}),
          CASE WHEN c.tags ?| $${tagIdx}::text[] THEN c.last_visit_at END
        ) AS effective_last_at
      FROM contacts c
      WHERE c.tenant_id = $1
        AND c.unsubscribed = false
        AND c.phone IS NOT NULL
        AND (
          c.tags ?| $${tagIdx}::text[]
          OR EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.tenant_id = c.tenant_id
              AND a.contact_id = c.id
              AND a.status NOT IN ('cancelled')
              AND ${apptMatch.clause}
          )
        )
    )
  `;

  return { sql, params };
}

const getOverview = async (tenantId) => {
  await assertRetentionEnabled(tenantId);

  const segments = await Promise.all(
    SLUICE_SERVICE_CATEGORIES.map(async (cat) => {
      const { sql, params } = buildSegmentedContactsQuery(tenantId, cat.key);
      const bucketCounts = RETENTION_BUCKETS.map((b) =>
        `(COUNT(*) FILTER (WHERE effective_last_at IS NULL OR effective_last_at < NOW() - INTERVAL '${b.days} days'))::int AS ${b.key}`,
      ).join(',\n        ');

      const result = await db.query(
        `${sql}
         SELECT ${bucketCounts}
         FROM segmented`,
        params,
      );

      return {
        key: cat.key,
        label: cat.label,
        campaignTags: cat.tagSlugs,
        buckets: Object.fromEntries(
          RETENTION_BUCKETS.map((b) => [b.key, result.rows[0]?.[b.key] ?? 0]),
        ),
      };
    }),
  );

  return {
    buckets: RETENTION_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      days: b.days,
      campaignLastVisit: b.campaignLastVisit,
    })),
    segments,
  };
};

const listContacts = async (tenantId, {
  category = 'all',
  bucket = 'not90d',
  page = 1,
  limit = 25,
}) => {
  await assertRetentionEnabled(tenantId);

  const cat = getCategory(category);
  const bucketDef = getBucket(bucket);
  const { sql, params } = buildSegmentedContactsQuery(tenantId, cat.key);
  const offset = (Math.max(1, page) - 1) * limit;

  const countResult = await db.query(
    `${sql}
     SELECT COUNT(*)::int AS total
     FROM segmented
     WHERE effective_last_at IS NULL OR effective_last_at < NOW() - INTERVAL '${bucketDef.days} days'`,
    params,
  );

  const dataResult = await db.query(
    `${sql}
     SELECT
       id,
       first_name,
       last_name,
       phone,
       email,
       tags,
       effective_last_at AS last_visit_at,
       CASE
         WHEN effective_last_at IS NULL THEN NULL
         ELSE EXTRACT(DAY FROM NOW() - effective_last_at)::int
       END AS days_since_visit
     FROM segmented
     WHERE effective_last_at IS NULL OR effective_last_at < NOW() - INTERVAL '${bucketDef.days} days'
     ORDER BY effective_last_at ASC NULLS FIRST, last_name ASC, first_name ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const total = countResult.rows[0]?.total ?? 0;

  return {
    category: { key: cat.key, label: cat.label, campaignTags: cat.tagSlugs },
    bucket: {
      key: bucketDef.key,
      label: bucketDef.label,
      days: bucketDef.days,
      campaignLastVisit: bucketDef.campaignLastVisit,
    },
    contacts: dataResult.rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      displayName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.phone,
      phone: r.phone,
      email: r.email,
      tags: r.tags || [],
      lastVisitAt: r.last_visit_at,
      daysSinceVisit: r.days_since_visit,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

module.exports = {
  isRetentionDashboardEnabled,
  getOverview,
  listContacts,
};
