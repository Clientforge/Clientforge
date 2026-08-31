import { useCallback, useEffect, useState } from 'react';
import api from '../api';

function formatIntervalDays(days) {
  if (days === 60) return '2 months';
  if (days === 90) return '3 months';
  if (days === 180) return '6 months';
  return `${days} days`;
}

export function useShopmonkeyClassification({ enabled = true } = {}) {
  const [categories, setCategories] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const [catRes, mapRes] = await Promise.all([
        api.get('/integrations/shopmonkey/master-categories'),
        api.get('/integrations/shopmonkey/service-mappings?limit=15'),
      ]);
      setAvailable(!!catRes.enabled);
      setCategories(catRes.categories || []);
      setMappings(mapRes.mappings || []);
      setMappingTotal(mapRes.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load service classification');
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { categories, mappings, mappingTotal, loading, error, available, reload };
}

export default function ShopmonkeyClassificationPanel({ enabled = true }) {
  const { categories, mappings, mappingTotal, loading, error, available } = useShopmonkeyClassification({ enabled });

  if (!enabled || !available) return null;

  return (
    <div className="integration-block" style={{ marginTop: 24 }}>
      <h4>Service classification</h4>
      <p className="settings-desc">
        Shopmonkey service lines are mapped to master categories. Each category sets a maintenance follow-up interval
        (Phase 2 will schedule reminders from these — not active yet).
      </p>

      {loading && <p className="settings-desc">Loading…</p>}
      {error && <p className="field-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Master categories ({categories.length})</label>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Follow-up interval</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td>{cat.name}</td>
                      <td>{formatIntervalDays(cat.followUpIntervalDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Learned mappings ({mappingTotal} total)</label>
            <p className="field-hint" style={{ marginTop: 4 }}>
              New Shopmonkey service names are auto-classified by keywords and saved for reuse.
            </p>
            {mappings.length === 0 ? (
              <p className="settings-desc">No mappings yet — complete a repair order with service lines to populate.</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Shopmonkey service</th>
                      <th>Category</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((row) => (
                      <tr key={row.id}>
                        <td>{row.serviceName}</td>
                        <td>{row.categoryName}</td>
                        <td>{row.matchSource}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
