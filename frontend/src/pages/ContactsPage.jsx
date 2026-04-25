import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const loadContacts = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      const [data, statsData] = await Promise.all([
        api.get(`/contacts?${params}`),
        api.get('/contacts/stats'),
      ]);
      setContacts(data.contacts);
      setPagination(data.pagination);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadContacts();
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="contacts-page">
      <div className="page-header">
        <div>
          <h1>Contacts</h1>
          <p className="page-subtitle">Manage your customer list for re-engagement campaigns</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Contact
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="mini-stat">
          <span className="mini-stat-value">{stats.total || 0}</span>
          <span className="mini-stat-label">Total Contacts</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{stats.active || 0}</span>
          <span className="mini-stat-label">Active</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{stats.unsubscribed || 0}</span>
          <span className="mini-stat-label">Unsubscribed</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">{stats.added_this_week || 0}</span>
          <span className="mini-stat-label">Added This Week</span>
        </div>
      </div>

      <div className="card">
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        </form>

        {loading ? (
          <div className="page-loader">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#94a3b8" strokeWidth="1.5"/></svg>
            </div>
            <p>No contacts yet</p>
            <p className="muted">Import a CSV file or add contacts manually to get started</p>
          </div>
        ) : (
          <>
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Tags</th>
                  <th>Source</th>
                  <th>Added</th>
                  <th style={{ width: '5.5rem' }}> </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="contact-name">
                      {c.firstName || ''} {c.lastName || ''}
                      {c.unsubscribed && <span className="badge-unsub">Opted out</span>}
                    </td>
                    <td className="mono">{c.phone}</td>
                    <td>{c.email || '—'}</td>
                    <td>
                      <div className="tag-list">
                        {(c.tags || []).map((t, i) => (
                          <span key={i} className="tag-chip">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="muted">{c.source}</td>
                    <td className="muted">{formatDate(c.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditingContact(c)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: pagination.totalPages }, (_, i) => (
                  <button key={i} className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`} onClick={() => loadContacts(i + 1)}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); loadContacts(); }} />
      )}

      {showAdd && (
        <AddContactModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); loadContacts(); }} />
      )}

      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSuccess={() => {
            setEditingContact(null);
            loadContacts(pagination.page || 1);
          }}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload('/contacts/import', formData);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Contacts from CSV</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <p className="modal-desc">
                Upload a CSV file with your customer list. The file should have columns for:
              </p>
              <div className="csv-columns">
                <span className="csv-col required">phone</span>
                <span className="csv-col">first_name</span>
                <span className="csv-col">last_name</span>
                <span className="csv-col">email</span>
                <span className="csv-col">tags</span>
                <span className="csv-col">notes</span>
              </div>
              <p className="hint">Only <strong>phone</strong> is required. Duplicates are auto-merged.</p>

              <div className="upload-area" onClick={() => fileRef.current.click()}>
                {file ? (
                  <div className="file-selected">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#6366f1" strokeWidth="2"/><polyline points="14,2 14,8 20,8" stroke="#6366f1" strokeWidth="2"/></svg>
                    <span>{file.name}</span>
                  </div>
                ) : (
                  <>
                    <svg width="36" height="36" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <p>Click to select a CSV file</p>
                    <p className="hint">Max 5MB</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
                  {uploading ? 'Importing...' : 'Import Contacts'}
                </button>
              </div>
            </>
          ) : result.error ? (
            <div className="import-result error">
              <p>Import failed: {result.error}</p>
              <button className="btn btn-secondary" onClick={() => setResult(null)}>Try Again</button>
            </div>
          ) : (
            <div className="import-result success">
              <div className="result-icon">
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#059669" strokeWidth="2"/><path d="M8 12l3 3 5-5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3>Import Complete!</h3>
              <div className="result-stats">
                <div><strong>{result.imported}</strong> imported</div>
                <div><strong>{result.skipped}</strong> skipped</div>
                <div><strong>{result.total}</strong> total rows</div>
              </div>
              {result.errors?.length > 0 && (
                <div className="result-errors">
                  <p>Some rows had errors:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="error-line">{e.phone}: {e.error}</p>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" onClick={onSuccess}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditContactModal({ contact, onClose, onSuccess }) {
  const [form, setForm] = useState({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    tags: (contact.tags || []).join(', '),
    notes: contact.notes || '',
  });
  const [tagOptions, setTagOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/contacts/tags');
        setTagOptions(d.tags || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/contacts/${contact.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        notes: form.notes || null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit contact</h2>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>Phone</label>
            <input type="text" value={contact.phone} readOnly className="input-readonly" />
            <p className="hint">Phone can’t be changed (used as the unique key).</p>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>First name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Last name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              list="edit-contact-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="vip, returning, promo"
            />
            <datalist id="edit-contact-tags">
              {tagOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Internal notes (optional)"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddContactModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.phone) { setError('Phone number is required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/contacts', {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Contact</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, returning, promo" />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Add Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
