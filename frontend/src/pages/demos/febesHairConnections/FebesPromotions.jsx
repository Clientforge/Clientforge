import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from './constants';
import { PROMOTIONS } from './content/promotions';
import { febesPath } from './febesBase';

export default function FebesPromotions() {
  useEffect(() => {
    document.title = `Promotions — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">Promotions</h1>
      <p className="febe-section-lead">Special offers for new guests, birthdays, and midweek appointments.</p>
      <div className="febe-grid-3" style={{ maxWidth: '720px', margin: '0 auto' }}>
        {PROMOTIONS.map((p) => (
          <article key={p.id} className="febe-card febe-promo-card">
            <h3>{p.title}</h3>
            <p>{p.detail}</p>
            <p className="febe-card-meta">Use code: {p.code}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--febe-muted)' }}>{p.note}</p>
          </article>
        ))}
      </div>
      <p style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
          Book with offer
        </Link>
      </p>
    </div>
  );
}
