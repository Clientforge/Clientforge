import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from './constants';
import { FAQ_ITEMS } from './content/faq';
import { febesPath } from './febesBase';

export default function FebesFaq() {
  useEffect(() => {
    document.title = `FAQ — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">FAQ</h1>
      <p className="febe-section-lead">Policies and tips so your appointment runs smoothly.</p>
      <div className="febe-faq" style={{ maxWidth: '40rem', margin: '0 auto' }}>
        {FAQ_ITEMS.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p style={{ color: 'var(--febe-muted)', margin: '0.75rem 0 0' }}>{item.a}</p>
          </details>
        ))}
      </div>
      <p style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
          Book appointment
        </Link>
      </p>
    </div>
  );
}
