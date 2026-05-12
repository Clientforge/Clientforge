import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearG2gOwnerToken, g2gOwnerMe, getG2gOwnerToken } from '../lib/g2gOwnerApi.js';

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    document.title = 'Owner — Grace to Grace';
  }, []);

  useEffect(() => {
    if (!getG2gOwnerToken()) {
      navigate('/owner/login', { replace: true });
      return undefined;
    }

    let cancelled = false;

    async function load() {
      try {
        const me = await g2gOwnerMe();
        if (!cancelled) setOwner(me);
      } catch {
        if (!cancelled) {
          clearG2gOwnerToken();
          navigate('/owner/login', { replace: true });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function signOut() {
    clearG2gOwnerToken();
    navigate('/owner/login', { replace: true });
  }

  if (!owner) {
    return (
      <p className="g2g-page-lead" aria-live="polite">
        Loading…
      </p>
    );
  }

  return (
    <>
      <h1 className="g2g-page-title">Owner dashboard</h1>
      <p className="g2g-page-lead">
        Signed in as <strong>{owner.username}</strong>. This area is for future owner-only tools and reports.
      </p>
      <div className="g2g-card" style={{ maxWidth: '36rem', padding: '1.25rem' }}>
        <p style={{ margin: '0 0 0.5rem', color: 'var(--g2g-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
          Account
        </p>
        <p style={{ margin: 0 }}>
          <span className="g2g-field-hint">ID</span> {owner.id}
        </p>
        {owner.last_login_at ? (
          <p style={{ margin: '0.75rem 0 0' }}>
            <span className="g2g-field-hint">Last sign in</span>{' '}
            {new Date(owner.last_login_at).toLocaleString()}
          </p>
        ) : null}
      </div>
      <div className="g2g-row" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="g2g-btn g2g-btn--ghost" onClick={signOut}>
          Sign out
        </button>
        <Link to="/" className="g2g-btn g2g-btn--primary">
          Back to site
        </Link>
      </div>
    </>
  );
}
