import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
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
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#rg)"/>
            <path d="M8 14l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs><linearGradient id="rg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
          </svg>
          <h1>Leadflow <span className="brand-ai">AI</span></h1>
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
