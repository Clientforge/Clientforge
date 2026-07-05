import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isSimpleMode } from '../utils/uiMode';

const BUCKET_ORDER = ['not30d', 'not90d', 'not180d', 'not365d'];

function formatDate(d) {
  if (!d) return 'No visit on file';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildCampaignUrl({ bucket, segment }) {
  const params = new URLSearchParams({ create: '1' });
  if (bucket?.campaignLastVisit) params.set('lastVisit', bucket.campaignLastVisit);
  if (segment?.campaignTags?.length) params.set('tags', segment.campaignTags.join(','));
  return `/campaigns?${params.toString()}`;
}

export default function RetentionPage() {
  const { tenant } = useAuth();
  const simple = isSimpleMode(tenant);
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
      setError(err.message || 'Could not load retention overview');
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
        limit: '25',
      });
      const data = await api.get(`/retention/contacts?${params}`);
      setContacts(data.contacts || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Could not load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [selectedCategory, selectedBucket]);

  useEffect(() => {
    if (tenant?.retentionDashboardEnabled) loadOverview();
  }, [tenant?.retentionDashboardEnabled, loadOverview]);

  useEffect(() => {
    if (tenant?.retentionDashboardEnabled) loadContacts(1);
  }, [tenant?.retentionDashboardEnabled, selectedCategory, selectedBucket, loadContacts]);

  if (!tenant?.retentionDashboardEnabled) {
    return <Navigate to={simple ? '/conversations' : '/dashboard'} replace />;
  }

  const activeSegment = overview?.segments?.find((s) => s.key === selectedCategory);
  const activeBucketMeta = overview?.buckets?.find((b) => b.key === selectedBucket);
  const bucketCounts = activeSegment?.buckets || {};

  return (
    <div className="retention-page">
      <div className="page-header">
        <div>
          <h1>Retention</h1>
          <p className="page-subtitle">
            Find lapsed patients by time since last visit and service type — then launch win-back outreach.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="retention-category">Service segment</label>
        <select
          id="retention-category"
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {(overview?.segments || []).map((seg) => (
            <option key={seg.key} value={seg.key}>{seg.label}</option>
          ))}
        </select>
      </div>

      <div className="retention-buckets stat-cards" style={{ marginBottom: '1.25rem' }}>
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

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>
              {activeSegment?.label || 'Patients'}
              {' · '}
              {activeBucketMeta?.label || selectedBucket}
            </h3>
            <p className="hint" style={{ margin: '0.25rem 0 0' }}>
              {pagination.total} patient{pagination.total === 1 ? '' : 's'} eligible for SMS win-back
            </p>
          </div>
          <Link
            className="btn btn-primary btn-sm"
            to={buildCampaignUrl({
              bucket: activeBucketMeta || { campaignLastVisit: selectedBucket },
              segment: activeSegment,
            })}
          >
            Create win-back campaign
          </Link>
        </div>

        {loadingContacts ? (
          <div className="page-loader">Loading patients…</div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
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
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.displayName}</td>
                      <td className="muted">{c.phone || '—'}</td>
                      <td className="muted">{formatDate(c.lastVisitAt)}</td>
                      <td>{c.daysSinceVisit != null ? c.daysSinceVisit : '—'}</td>
                      <td className="muted">{(c.tags || []).slice(0, 3).join(', ')}{(c.tags || []).length > 3 ? '…' : ''}</td>
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
