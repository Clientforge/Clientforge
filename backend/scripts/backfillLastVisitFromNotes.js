#!/usr/bin/env node
/**
 * Backfill contacts.last_visit_at from notes ("Last visit: YYYY-MM-DD") and appointments.
 *
 * Usage:
 *   node scripts/backfillLastVisitFromNotes.js [tenantId]
 *
 * If tenantId is omitted, updates all tenants.
 */
const db = require('../src/db/connection');

const tenantId = process.argv[2] || null;

async function run() {
  const params = [];
  const tenantClause = tenantId ? 'AND c.tenant_id = $1' : '';
  if (tenantId) params.push(tenantId);

  const result = await db.query(
    `WITH candidates AS (
       SELECT
         c.id,
         c.last_visit_at,
         COALESCE(
           (SELECT MAX(a.scheduled_at) FROM appointments a
            WHERE a.tenant_id = c.tenant_id AND a.contact_id = c.id
              AND a.status NOT IN ('cancelled')),
           CASE
             WHEN c.notes ~ 'Last visit: [0-9]{4}-[0-9]{2}-[0-9]{2}'
             THEN (substring(c.notes from 'Last visit: ([0-9]{4}-[0-9]{2}-[0-9]{2})'))::timestamptz
             ELSE NULL
           END
         ) AS parsed_last_visit
       FROM contacts c
       WHERE TRUE ${tenantClause}
     )
     UPDATE contacts c
     SET last_visit_at = GREATEST(COALESCE(c.last_visit_at, cand.parsed_last_visit), cand.parsed_last_visit),
         updated_at = NOW()
     FROM candidates cand
     WHERE c.id = cand.id
       AND cand.parsed_last_visit IS NOT NULL
       AND (c.last_visit_at IS NULL OR c.last_visit_at < cand.parsed_last_visit)
     RETURNING c.id`,
    params,
  );

  console.log(`Updated last_visit_at for ${result.rowCount} contact(s)${tenantId ? ` (tenant ${tenantId})` : ''}.`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit());
