import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from './constants';
import { fetchG2gLocations } from './g2gSeoApi';
import { g2gPath } from './g2gBase';
import { useG2gPageMeta } from './useG2gPageMeta';

export default function G2GLocationHub() {
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');

  useG2gPageMeta({
    title: `Cash for Junk Cars — Metro Atlanta Locations | ${BRAND}`,
    description:
      'Find cash-for-junk-cars pages for Alpharetta, Sandy Springs, Buckhead, Cobb, Cherokee, and more across Metro Atlanta.',
    canonical: typeof window !== 'undefined' ? `${window.location.origin}/cash-for-junk-cars/` : undefined,
  });

  useEffect(() => {
    let cancelled = false;
    fetchG2gLocations()
      .then((rows) => {
        if (!cancelled) setLocations(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load service areas. Please try again later.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="g2g-home">
      <section className="g2g-hero g2g-hero--marketing" aria-labelledby="g2g-locations-heading">
        <p className="g2g-hero-eyebrow">Metro Atlanta · local pickup</p>
        <h1 id="g2g-locations-heading">Cash for junk cars near you</h1>
        <p className="g2g-hero-lead">
          Choose your city for local details, FAQs, and a fast online estimate — same simple process everywhere we serve.
        </p>
        <Link to={g2gPath('offer')} className="g2g-btn g2g-btn--primary">
          Get my cash offer
        </Link>
      </section>

      <section className="g2g-section g2g-section--surface">
        <h2 className="g2g-section-heading">Service areas</h2>
        {error && <p className="g2g-muted-block">{error}</p>}
        <ul className="g2g-location-hub-list" role="list">
          {locations.map((loc) => (
            <li key={loc.slug}>
              <Link to={g2gPath('cash-for-junk-cars', loc.slug)} className="g2g-location-hub-link">
                <strong>Cash for junk cars in {loc.displayName}</strong>
                <span className="g2g-location-hub-chevron" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
