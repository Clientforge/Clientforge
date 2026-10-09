import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function CreateTenantPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    sendWelcomeEmail: true,
    sendCredentialsEmail: true,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [key]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        businessName: form.businessName,
        industry: form.industry || undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email,
        sendWelcomeEmail: form.sendWelcomeEmail,
        sendCredentialsEmail: form.sendCredentialsEmail,
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }
      const result = await api.post('/admin/tenants', payload);
      if (result.temporaryPassword) {
        window.alert(
          `Account created. Credentials email may have failed — copy this temporary password now:\n\n${result.temporaryPassword}`,
        );
      }
      navigate(`/admin/tenants/${result.tenant.id}`);
    } catch (err) {
      setError(err.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <p className="page-sub" style={{ marginBottom: 8 }}>
        <Link to="/admin/tenants">← Businesses</Link>
      </p>
      <h1>Create business account</h1>
      <p className="page-sub" style={{ marginBottom: 24 }}>
        Provisions a new tenant and admin user. Public signup can stay disabled.
      </p>

      <div className="card" style={{ maxWidth: 520 }}>
        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Business name</label>
            <input value={form.businessName} onChange={set('businessName')} required placeholder="Bay Area Heart" />
          </div>
          <div className="field">
            <label>Industry (optional)</label>
            <input value={form.industry} onChange={set('industry')} placeholder="Healthcare" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>First name</label>
              <input value={form.firstName} onChange={set('firstName')} placeholder="Jane" />
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={form.lastName} onChange={set('lastName')} placeholder="Smith" />
            </div>
          </div>
          <div className="field">
            <label>Admin email</label>
            <input type="email" value={form.email} onChange={set('email')} required placeholder="admin@business.com" />
          </div>
          <div className="field">
            <label>Password (optional)</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Leave blank to auto-generate"
              minLength={8}
            />
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              If blank, a temporary password is generated and emailed when credentials email is enabled.
            </p>
          </div>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <input type="checkbox" checked={form.sendWelcomeEmail} onChange={set('sendWelcomeEmail')} />
            Send welcome email (getting started)
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <input type="checkbox" checked={form.sendCredentialsEmail} onChange={set('sendCredentialsEmail')} />
            Email sign-in credentials when password is auto-generated
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 16, width: '100%' }}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
