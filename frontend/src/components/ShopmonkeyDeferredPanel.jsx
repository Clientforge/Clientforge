import { useEffect, useState } from 'react';
import { api } from '../api/client';

const STATUS_STYLES = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Detected' },
  followup_scheduled: { bg: '#dbeafe', color: '#1e40af', label: 'Follow-up scheduled' },
  followup_sent: { bg: '#d1fae5', color: '#065f46', label: 'Follow-up sent' },
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status, statusLabel }) {
  const style = STATUS_STYLES[status] || { bg: '#f3f4f6', color: '#374151', label: statusLabel || status };
  return (
    <span
      className="status-badge"
      style={{ background: style.bg, color: style.color, fontSize: 12 }}
    >
      {statusLabel || style.label || status}
    </span>
  );
}

export function ShopmonkeyDeferredSummary({ summary }) {
  if (!summary) return null;

  const schedule = summary.followupSchedule || [7, 14, 30, 60];

  return (
    <div className="stats-row" style={{ marginTop: 12, marginBottom: 12 }}>
      <div className="mini-stat">
        <span className="mini-stat-value">{summary.active || 0}</span>
        <span className="mini-stat-label">Open deferred</span>
      </div>
      <div className="mini-stat">
        <span className="mini-stat-value">{summary.scheduled || 0}</span>
        <span className="mini-stat-label">Sequences active</span>
      </div>
      <div className="mini-stat">
        <span className="mini-stat-value">{summary.sent || 0}</span>
        <span className="mini-stat-label">Sequences complete</span>
      </div>
      <div className="mini-stat">
        <span className="mini-stat-value">{schedule.length}</span>
        <span className="mini-stat-label">Steps ({schedule.join('/') }d)</span>
      </div>
    </div>
  );
}

export function ShopmonkeyDeferredTable({ items, showContact = true, compact = false }) {
  if (!items?.length) {
    return (
      <p className="settings-desc" style={{ margin: 0 }}>
        No deferred service follow-ups yet. They appear when a completed repair order includes declined or recommended work.
      </p>
    );
  }

  return (
    <div className={`table-wrap${compact ? ' table-compact' : ''}`} style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            {showContact && <th>Client</th>}
            <th>Service</th>
            {!compact && <th>Vehicle</th>}
            <th>Deferred</th>
            <th>Status</th>
            <th>Follow-up</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {showContact && (
                <td>
                  <div>{item.contactName}</div>
                  {item.phone && <div className="muted" style={{ fontSize: 12 }}>{item.phone}</div>}
                </td>
              )}
              <td>{item.serviceName}</td>
              {!compact && <td>{item.vehicleLabel || '—'}</td>}
              <td>{formatDate(item.deferredAt)}</td>
              <td><StatusBadge status={item.status} statusLabel={item.statusLabel} /></td>
              <td>
                {item.followupScheduledAt
                  ? formatDateTime(item.followupScheduledAt)
                  : item.status === 'followup_sent'
                    ? 'Sent'
                    : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useShopmonkeyDeferred({ contactId, enabled = true, limit = 25 } = {}) {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(null);

  const load = async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (contactId) params.set('contactId', contactId);

      const requests = [
        api.get(`/integrations/shopmonkey/deferred-services?${params}`),
      ];
      if (!contactId) {
        requests.push(api.get('/integrations/shopmonkey/deferred-services/summary'));
      }

      const [listData, summaryData] = await Promise.all(requests);
      setItems(listData.items || []);
      if (summaryData) setSummary(summaryData);
      setAvailable(true);
    } catch (err) {
      if (err.status === 403) {
        setAvailable(false);
        setItems([]);
        setSummary(null);
      } else {
        setError(err.message || 'Could not load deferred follow-ups');
        setAvailable(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [contactId, enabled, limit]);

  return { summary, items, loading, error, available, reload: load };
}

export default function ShopmonkeyDeferredPanel({
  contactId,
  enabled = true,
  showContact = true,
  compact = false,
  title = 'Deferred service follow-ups',
  description,
  hideWhenUnavailable = false,
}) {
  const { summary, items, loading, error, available, reload } = useShopmonkeyDeferred({ contactId, enabled });

  if (!enabled || (hideWhenUnavailable && available === false)) return null;

  return (
    <div className="integration-block" style={{ marginTop: compact ? 0 : 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h4 style={{ margin: '0 0 4px' }}>{title}</h4>
          {description && <p className="settings-desc" style={{ margin: 0 }}>{description}</p>}
        </div>
        {!compact && (
          <button type="button" className="btn-sm" onClick={reload} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </div>

      {error && <p className="field-hint" style={{ marginTop: 8 }}>{error}</p>}

      {!contactId && summary && (
        <ShopmonkeyDeferredSummary summary={summary} />
      )}

      {loading && items.length === 0 ? (
        <p className="settings-desc" style={{ marginTop: 12 }}>Loading deferred follow-ups…</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <ShopmonkeyDeferredTable items={items} showContact={showContact} compact={compact} />
        </div>
      )}
    </div>
  );
}
