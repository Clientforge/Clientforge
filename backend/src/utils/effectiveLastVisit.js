/**
 * Effective last visit: appointments (non-cancelled) → last_visit_at → notes "Last visit: YYYY-MM-DD".
 * Used for campaign audience filtering when visit-history presets are applied.
 */
const effectiveLastVisitSql = (alias = 'c') => `COALESCE(
  (SELECT MAX(a.scheduled_at) FROM appointments a
   WHERE a.tenant_id = ${alias}.tenant_id AND a.contact_id = ${alias}.id
     AND a.status NOT IN ('cancelled')),
  ${alias}.last_visit_at,
  CASE
    WHEN ${alias}.notes ~ 'Last visit: [0-9]{4}-[0-9]{2}-[0-9]{2}'
    THEN (substring(${alias}.notes from 'Last visit: ([0-9]{4}-[0-9]{2}-[0-9]{2})'))::timestamptz
    ELSE NULL
  END
)`;

const buildAudienceContactsCte = (innerWhereSql) => `WITH audience_contacts AS (
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.phone,
    c.email,
    ${effectiveLastVisitSql('c')} AS effective_last_at
  FROM contacts c
  WHERE ${innerWhereSql}
)`;

module.exports = {
  effectiveLastVisitSql,
  buildAudienceContactsCte,
};
