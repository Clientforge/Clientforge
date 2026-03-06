import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.role !== 'superadmin') {
        setError('Admin access only. Use the regular login for tenant accounts.');
        setLoading(false);
        return;
      }
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page-admin">
      <div className="auth-card auth-card-admin">
        <div className="auth-brand auth-brand-admin">
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#adminGrad)"/>
            <path d="M8 14l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="adminGrad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#dc2626"/>
                <stop offset="1" stopColor="#f59e0b"/>
              </linearGradient>
            </defs>
          </svg>
          <h1>Leadflow <span className="brand-admin">Admin</span></h1>
        </div>
        <h2>Platform Admin</h2>
        <p className="auth-sub">Sign in to the admin dashboard</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@leadflow.ai" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary-full btn-admin" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In to Admin'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">← Regular user login</Link>
        </p>
      </div>
    </div>
  );
}
