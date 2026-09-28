import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-help-request', {
        email: email.trim(),
        message: message.trim() || undefined,
      });
      setSubmitted(true);
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
            <rect width="28" height="28" rx="8" fill="url(#fg)" />
            <path d="M8 14l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="fg" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <h1>ClientForge<span className="brand-ai">.ai</span></h1>
        </div>

        {submitted ? (
          <>
            <h2>Request received</h2>
            <p className="auth-sub">
              If an account exists for that email, our team will reset your password and email you a temporary
              password so you can sign in again.
            </p>
            <p className="auth-footer" style={{ marginTop: 24 }}>
              <Link to="/login">← Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h2>Need help signing in?</h2>
            <p className="auth-sub">
              Enter your work email. Our team will verify your account and send you a new temporary password.
            </p>

            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label>Message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Anything that helps us verify your account"
                  rows={3}
                  maxLength={500}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '1rem' }}
                />
              </div>
              <button type="submit" className="btn-primary-full" disabled={loading}>
                {loading ? 'Sending...' : 'Request password help'}
              </button>
            </form>

            <p className="auth-footer">
              <Link to="/login">← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
