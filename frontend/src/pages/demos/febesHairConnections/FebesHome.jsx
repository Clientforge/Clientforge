import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, IMAGES, TAGLINE } from './constants';
import { SERVICES } from './content/services';
import { TESTIMONIALS } from './content/reviews';
import { PROMOTIONS } from './content/promotions';
import { febesPath } from './febesBase';

export default function FebesHome() {
  useEffect(() => {
    document.title = `${BRAND} — Salon in Morrow, GA`;
  }, []);

  const featured = SERVICES.slice(0, 4);

  return (
    <>
      <section
        className="febe-hero"
        style={{ backgroundImage: `url(${IMAGES.hero})` }}
        aria-labelledby="febe-hero-heading"
      >
        <div className="febe-hero-content">
          <p className="febe-hero-eyebrow">Morrow · Mt Zion Rd</p>
          <h1 id="febe-hero-heading">Where your hair feels cared for</h1>
          <p className="febe-hero-lead">{TAGLINE}</p>
          <div className="febe-hero-actions">
            <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
              Book appointment
            </Link>
            <Link to={febesPath('services')} className="febe-btn febe-btn--ghost">
              View services
            </Link>
          </div>
        </div>
      </section>

      <section className="febe-section febe-section--tight">
        <h2 className="febe-section-heading">Signature services</h2>
        <p className="febe-section-lead">From silk press to loc maintenance — expert care in a calm, beautiful space.</p>
        <div className="febe-grid-3">
          {featured.map((s) => (
            <article key={s.id} className="febe-card">
              <h3>{s.name}</h3>
              <p className="febe-card-meta">
                {s.duration} · from ${s.from}
              </p>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to={febesPath('services')} className="febe-btn febe-btn--ghost">
            All services
          </Link>
        </p>
      </section>

      <section className="febe-section" style={{ background: 'var(--febe-surface)' }}>
        <h2 className="febe-section-heading">Client love</h2>
        <div className="febe-grid-3">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name} className="febe-card">
              <p className="febe-stars" aria-hidden>
                {'★'.repeat(t.stars)}
              </p>
              <p>&ldquo;{t.quote}&rdquo;</p>
              <footer>
                <strong>{t.name}</strong>
                <span style={{ color: 'var(--febe-muted)', fontSize: '0.88rem' }}> — {t.service}</span>
              </footer>
            </blockquote>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to={febesPath('reviews')}>More reviews</Link>
        </p>
      </section>

      <section className="febe-section">
        <h2 className="febe-section-heading">Current offers</h2>
        <div className="febe-grid-3">
          {PROMOTIONS.map((p) => (
            <article key={p.id} className="febe-card febe-promo-card">
              <h3>{p.title}</h3>
              <p>{p.detail}</p>
              <p className="febe-card-meta">Code: {p.code}</p>
            </article>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to={febesPath('promotions')}>Promotion details</Link>
        </p>
      </section>
    </>
  );
}
