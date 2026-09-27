import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from './constants';
import { GOOGLE_HIGHLIGHT, TESTIMONIALS } from './content/reviews';
import { febesPath } from './febesBase';

export default function FebesReviews() {
  useEffect(() => {
    document.title = `Reviews — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">Reviews</h1>
      <div className="febe-card" style={{ maxWidth: '28rem', margin: '0 auto 2rem', textAlign: 'center' }}>
        <p className="febe-stars" style={{ fontSize: '1.5rem' }}>
          ★★★★★
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0' }}>{GOOGLE_HIGHLIGHT.rating}</p>
        <p style={{ color: 'var(--febe-muted)' }}>Based on {GOOGLE_HIGHLIGHT.count}+ Google reviews (demo)</p>
        <p>{GOOGLE_HIGHLIGHT.summary}</p>
      </div>
      <div className="febe-grid-3">
        {TESTIMONIALS.map((t) => (
          <blockquote key={t.name} className="febe-card">
            <p className="febe-stars">{'★'.repeat(t.stars)}</p>
            <p>&ldquo;{t.quote}&rdquo;</p>
            <footer>
              <strong>{t.name}</strong> — {t.service}
            </footer>
          </blockquote>
        ))}
      </div>
      <p style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
          Book your appointment
        </Link>
      </p>
    </div>
  );
}
