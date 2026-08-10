/**
 * Effective last visit: appointments (non-cancelled) → last_visit_at → notes "Last visit: YYYY-MM-DD".
 * Used for campaign audience filtering when visit-history presets are applied.
 */
const appointmentLastVisitSql = (alias = 'c') => `(
  SELECT MAX(a.scheduled_at) FROM appointments a
  WHERE a.tenant_id = ${alias}.tenant_id AND a.contact_id = ${alias}.id
    AND a.status NOT IN ('cancelled')
)`;

const effectiveLastVisitSql = (alias = 'c') => `COALESCE(
  ${appointmentLastVisitSql(alias)},
  ${alias}.last_visit_at,
  CASE
    WHEN ${alias}.notes ~ 'Last visit: [0-9]{4}-[0-9]{2}-[0-9]{2}'
    THEN (substring(${alias}.notes from 'Last visit: ([0-9]{4}-[0-9]{2}-[0-9]{2})'))::timestamptz
    ELSE NULL
  END
)`;

const lastVisitSqlForSource = (alias, source = 'effective') => (
  source === 'appointments' ? appointmentLastVisitSql(alias) : effectiveLastVisitSql(alias)
);

const buildAudienceContactsCte = (innerWhereSql, { visitSource = 'effective' } = {}) => `WITH audience_contacts AS (
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.phone,
    c.email,
    ${lastVisitSqlForSource('c', visitSource)} AS effective_last_at
  FROM contacts c
  WHERE ${innerWhereSql}
)`;

module.exports = {
  appointmentLastVisitSql,
  effectiveLastVisitSql,
  lastVisitSqlForSource,
  buildAudienceContactsCte,
};
