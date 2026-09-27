import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from './constants';
import { SERVICES } from './content/services';
import { febesPath } from './febesBase';

export default function FebesServices() {
  useEffect(() => {
    document.title = `Services — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">Services</h1>
      <p className="febe-section-lead">
        Pricing shown is starting from — final quote at consultation. Duration varies by hair length and
        style.
      </p>
      <div className="febe-grid-3">
        {SERVICES.map((s) => (
          <article key={s.id} className="febe-card">
            <h3>{s.name}</h3>
            <p className="febe-card-meta">
              {s.duration} · <span className="febe-price">from ${s.from}</span>
            </p>
            <p>{s.desc}</p>
            <p style={{ marginTop: '1rem' }}>
              <Link to={febesPath('book')} state={{ serviceId: s.id }} className="febe-btn febe-btn--ghost febe-btn--sm">
                Book this service
              </Link>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
