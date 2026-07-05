import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const BUCKET_ORDER = ['not30d', 'not90d', 'not180d', 'not365d'];

function formatDate(d) {
  if (!d) return 'No visit on file';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildWinBackCampaignUrl({ bucket, segment }) {
  const params = new URLSearchParams({ create: '1' });
  if (bucket?.campaignLastVisit) params.set('lastVisit', bucket.campaignLastVisit);
  if (segment?.campaignTags?.length) params.set('tags', segment.campaignTags.join(','));
  return `/campaigns?${params.toString()}`;
}

export function buildWinBackAudienceFilter({ bucket, segment }) {
  const filter = {};
  const lastVisit = bucket?.campaignLastVisit || bucket?.key;
  if (lastVisit) filter.lastVisit = lastVisit;
  if (segment?.campaignTags?.length) filter.tags = segment.campaignTags;
  return filter;
}

/**
 * Filter-driven win-back / retention panel (Sluice).
 * @param {object} props
 * @param {boolean} [props.embedded] — compact layout for Outreach page
 * @param {(filter: object, meta: object) => void} [props.onLaunchCampaign] — open campaign composer in-place
 * @param {(stats: { inactiveCount: number, bucketKey: string, categoryKey: string }) => void} [props.onStatsChange]
 */
export default function WinBackRetentionPanel({
  embedded = false,
  onLaunchCampaign,
  onStatsChange,
}) {
  const [overview, setOverview] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBucket, setSelectedBucket] = useState('not90d');
  const [contacts, setContacts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setError('');
    try {
      const data = await api.get('/retention/overview');
      setOverview(data);
    } catch (err) {
      setError(err.message || 'Could not load win-back data');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadContacts = useCallback(async (page = 1) => {
    setLoadingContacts(true);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        bucket: selectedBucket,
        page: String(page),
        limit: embedded ? '10' : '25',
      });
      const data = await api.get(`/retention/contacts?${params}`);
      setContacts(data.contacts || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Could not load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [selectedCategory, selectedBucket, embedded]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadContacts(1);
  }, [selectedCategory, selectedBucket, loadContacts]);

  const activeSegment = overview?.segments?.find((s) => s.key === selectedCategory);
  const activeBucketMeta = overview?.buckets?.find((b) => b.key === selectedBucket);
  const bucketCounts = activeSegment?.buckets || {};

  useEffect(() => {
    if (!onStatsChange) return;
    onStatsChange({
      inactiveCount: bucketCounts[selectedBucket] ?? pagination.total ?? 0,
      bucketKey: selectedBucket,
      categoryKey: selectedCategory,
    });
  }, [bucketCounts, selectedBucket, selectedCategory, pagination.total, onStatsChange]);

  const launchMeta = {
    bucket: activeBucketMeta || { campaignLastVisit: selectedBucket, key: selectedBucket },
    segment: activeSegment,
  };

  const campaignAction = onLaunchCampaign ? (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => onLaunchCampaign(buildWinBackAudienceFilter(launchMeta), launchMeta)}
    >
      Create win-back campaign
    </button>
  ) : (
    <Link className="btn btn-primary btn-sm" to={buildWinBackCampaignUrl(launchMeta)}>
      Create win-back campaign
    </Link>
  );

  return (
    <div className={`winback-retention-panel ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <p className="hint" style={{ margin: '0 0 1rem' }}>
          Filter lapsed patients by service and time since last visit, then launch a targeted win-back campaign.
        </p>
      )}

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="winback-retention-filters">
        <div className="form-group" style={{ marginBottom: embedded ? '0.75rem' : '1rem', flex: 1 }}>
          <label htmlFor="winback-category">Service segment</label>
          <select
            id="winback-category"
            className="filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {(overview?.segments || []).map((seg) => (
              <option key={seg.key} value={seg.key}>{seg.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="retention-buckets stat-cards" style={{ marginBottom: embedded ? '1rem' : '1.25rem' }}>
        {BUCKET_ORDER.map((bucketKey) => {
          const meta = overview?.buckets?.find((b) => b.key === bucketKey);
          const count = bucketCounts[bucketKey] ?? (loadingOverview ? '…' : 0);
          const selected = selectedBucket === bucketKey;
          return (
            <button
              key={bucketKey}
              type="button"
              className={`stat-card retention-bucket-card ${selected ? 'selected' : ''}`}
              onClick={() => setSelectedBucket(bucketKey)}
            >
              <div className="stat-top">
                <span className="stat-label">{meta?.label || bucketKey}</span>
              </div>
              <div className="stat-value">{count}</div>
              <div className="stat-change neutral">Inactive patients</div>
            </button>
          );
        })}
      </div>

      <div className={embedded ? '' : 'card'} style={embedded ? { padding: 0 } : undefined}>
        <div className="card-header-row">
          <div>
            <h3 style={embedded ? { fontSize: '1rem', margin: 0 } : undefined}>
              {embedded ? 'Inactive patients' : 'Win-back patients'}
              {' · '}
              {activeSegment?.label || 'All services'}
              {' · '}
              {activeBucketMeta?.label || selectedBucket}
            </h3>
            <p className="hint" style={{ margin: '0.25rem 0 0' }}>
              {pagination.total} patient{pagination.total === 1 ? '' : 's'} eligible for SMS win-back
            </p>
          </div>
          {campaignAction}
        </div>

        {loadingContacts ? (
          <div className="page-loader" style={{ padding: '1.5rem 0' }}>Loading patients…</div>
        ) : contacts.length === 0 ? (
          <div className="empty-state" style={{ padding: embedded ? '1rem 0' : undefined }}>
            <p>No inactive patients in this segment</p>
            <span>Try another time bucket or service category</span>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Phone</th>
                    <th>Last visit</th>
                    <th>Days inactive</th>
                    {!embedded && <th>Tags</th>}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.displayName}</td>
                      <td className="muted">{c.phone || '—'}</td>
                      <td className="muted">{formatDate(c.lastVisitAt)}</td>
                      <td>{c.daysSinceVisit != null ? c.daysSinceVisit : '—'}</td>
                      {!embedded && (
                        <td className="muted">
                          {(c.tags || []).slice(0, 3).join(', ')}
                          {(c.tags || []).length > 3 ? '…' : ''}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="pagination" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadContacts(pagination.page - 1)}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadContacts(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
