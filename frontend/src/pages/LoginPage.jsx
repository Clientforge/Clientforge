import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../utils/uiMode';
import { useRegistrationEnabled } from '../hooks/useRegistrationEnabled';
import BrandLogo from '../components/BrandLogo';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { registrationEnabled, loading: regLoading } = useRegistrationEnabled();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(data.user.role === 'superadmin' ? '/admin' : homePath(data.tenant));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandLogo size="lg" />
        </div>
        <h2>Welcome back</h2>
        <p className="auth-sub">Sign in to your dashboard</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <label>Password</label>
              <Link to="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {!regLoading && registrationEnabled && (
          <p className="auth-footer">
            No account yet? <Link to="/register">Create one</Link>
          </p>
        )}
        <p className="auth-footer" style={{ marginTop: 8, fontSize: 12 }}>
          <Link to="/admin/login">Platform admin login</Link>
        </p>
      </div>
    </div>
  );
}
