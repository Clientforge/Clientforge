import { useEffect } from 'react';
import { CONTACT_EMAIL } from './constants';

export default function G2GContact() {
  useEffect(() => {
    document.title = 'Contact — Grace to Grace';
  }, []);

  return (
    <>
      <h1 className="g2g-page-title">Contact</h1>
      <p className="g2g-page-lead">
        Questions about selling a vehicle or partnering with Grace to Grace? Reach out — we&apos;ll route this to the
        right person once your deployment email is configured.
      </p>
      <div className="g2g-card" style={{ maxWidth: '28rem' }}>
        <p style={{ margin: '0 0 0.75rem' }}>
          <strong>Email</strong>
        </p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        <p className="g2g-field-hint" style={{ marginTop: '1rem' }}>
          Set <code style={{ color: 'var(--g2g-amber)' }}>VITE_CONTACT_EMAIL</code> when building the ClientForge
          frontend for production.
        </p>
      </div>
    </>
  );
}
