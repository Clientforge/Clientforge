import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../utils/uiMode';
import { useRegistrationEnabled } from '../hooks/useRegistrationEnabled';
import BrandLogo from '../components/BrandLogo';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { registrationEnabled, loading: regLoading } = useRegistrationEnabled();
  const [form, setForm] = useState({ businessName: '', firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register(form);
      navigate(homePath(data.tenant));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!regLoading && !registrationEnabled) {
    return <Navigate to="/login" replace />;
  }

  if (regLoading) {
    return <div className="auth-page"><div className="auth-card"><p className="auth-sub">Loading…</p></div></div>;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandLogo size="lg" />
        </div>
        <h2>Create your account</h2>
        <p className="auth-sub">Start converting leads in minutes</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Business Name</label>
            <input value={form.businessName} onChange={set('businessName')} placeholder="Acme Dental" required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>First Name</label>
              <input value={form.firstName} onChange={set('firstName')} placeholder="John" />
            </div>
            <div className="field">
              <label>Last Name</label>
              <input value={form.lastName} onChange={set('lastName')} placeholder="Doe" />
            </div>
          </div>
          <div className="field">
            <label>Work Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" required minLength={8} />
          </div>
          <button type="submit" className="btn-primary-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Get Started Free'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
