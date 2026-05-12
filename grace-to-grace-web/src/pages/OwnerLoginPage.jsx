import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { g2gOwnerLogin, setG2gOwnerToken } from '../lib/g2gOwnerApi.js';

export default function OwnerLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Owner sign in — Grace to Grace';
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await g2gOwnerLogin({ username, password });
      setG2gOwnerToken(token);
      navigate('/owner', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="g2g-page-title">Owner sign in</h1>
      <p className="g2g-page-lead">
        Access the Grace to Grace owner area with your dedicated username and password.
      </p>
      {error ? (
        <p className="g2g-alert g2g-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="g2g-form" onSubmit={onSubmit} noValidate>
        <div className="g2g-field">
          <label htmlFor="g2g-owner-user">Username</label>
          <input
            id="g2g-owner-user"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="g2g-field">
          <label htmlFor="g2g-owner-pass">Password</label>
          <input
            id="g2g-owner-pass"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="g2g-row">
          <button type="submit" className="g2g-btn g2g-btn--primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <Link to="/" className="g2g-btn g2g-btn--ghost">
            Back to site
          </Link>
        </div>
      </form>
    </>
  );
}
