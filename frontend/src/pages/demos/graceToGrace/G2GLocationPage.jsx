import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
  BRAND,
} from './constants';
import { HOW_IT_WORKS_STEPS, TRUST_CHIPS } from './homeContent';
import { fetchG2gLocation } from './g2gSeoApi';
import { g2gPath } from './g2gBase';
import { saveG2gSeoLocationSlug } from './g2gSeoStorage';
import { useG2gPageMeta } from './useG2gPageMeta';

export default function G2GLocationPage() {
  const { slug } = useParams();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetchG2gLocation(slug)
      .then((loc) => {
        if (cancelled) return;
        if (!loc) {
          setNotFound(true);
          setLocation(null);
        } else {
          setLocation(loc);
          saveG2gSeoLocationSlug(loc.slug);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const offerQuery = location?.primaryZip
    ? `?location=${encodeURIComponent(location.slug)}&zip=${encodeURIComponent(location.primaryZip)}`
    : location?.slug
      ? `?location=${encodeURIComponent(location.slug)}`
      : '';

  useG2gPageMeta({
    title: location?.metaTitle || `${BRAND} — ${location?.displayName || ''}`,
    description: location?.metaDescription || location?.heroSubhead,
    canonical:
      location && typeof window !== 'undefined'
        ? `${window.location.origin}/cash-for-junk-cars/${location.slug}/`
        : undefined,
  });

  if (!loading && notFound) {
    return <Navigate to={g2gPath('cash-for-junk-cars')} replace />;
  }

  if (loading || !location) {
    return (
      <div className="g2g-home">
        <p className="g2g-muted-block" style={{ padding: '2rem' }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="g2g-home">
      <nav className="g2g-breadcrumb" aria-label="Breadcrumb">
        <Link to={g2gPath()}>Home</Link>
        <span aria-hidden> / </span>
        <Link to={g2gPath('cash-for-junk-cars')}>Cash for junk cars</Link>
        <span aria-hidden> / </span>
        <span>{location.displayName}</span>
      </nav>

      <section className="g2g-hero g2g-hero--marketing" aria-labelledby="g2g-loc-hero">
        <p className="g2g-hero-eyebrow">{location.displayName}</p>
        <h1 id="g2g-loc-hero">{location.heroHeadline}</h1>
        <p className="g2g-hero-lead">{location.heroSubhead}</p>
        <div className="g2g-hero-actions">
          <Link to={`${g2gPath('offer')}${offerQuery}`} className="g2g-btn g2g-btn--primary">
            Get my cash offer
          </Link>
          <a href={`tel:${CONTACT_PHONE_E164}`} className="g2g-btn g2g-btn--ghost">
            Call {CONTACT_PHONE_DISPLAY}
          </a>
        </div>
        <ul className="g2g-trust-chips" role="list">
          {TRUST_CHIPS.map((c) => (
            <li key={c.label}>{c.label}</li>
          ))}
        </ul>
      </section>

      <section className="g2g-section">
        <h2 className="g2g-section-heading">Junk car buyers in {location.city}</h2>
        <p className="g2g-section-lead g2g-location-intro">{location.localIntro}</p>
        {location.neighborhoods?.length > 0 && (
          <>
            <h3 className="g2g-subheading">Areas we often serve</h3>
            <ul className="g2g-neighborhood-list" role="list">
              {location.neighborhoods.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="g2g-section g2g-section--surface">
        <h2 className="g2g-section-heading">How it works</h2>
        <ol className="g2g-steps g2g-steps--compact">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <li key={step.title} className="g2g-step">
              <span className="g2g-step__num">{i + 1}</span>
              <h3 className="g2g-step__title">{step.title}</h3>
              <p className="g2g-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {location.localFaq?.length > 0 && (
        <section className="g2g-section" id="faq">
          <h2 className="g2g-section-heading">{location.city} FAQ</h2>
          <div className="g2g-faq-list">
            {location.localFaq.map((item) => (
              <details key={item.q} className="g2g-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {location.nearby?.length > 0 && (
        <section className="g2g-section g2g-section--surface">
          <h2 className="g2g-section-heading">Nearby service areas</h2>
          <ul className="g2g-location-hub-list" role="list">
            {location.nearby.map((n) => (
              <li key={n.slug}>
                <Link to={g2gPath('cash-for-junk-cars', n.slug)} className="g2g-location-hub-link">
                  Cash for junk cars in {n.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="g2g-section g2g-cta-band">
        <p className="g2g-cta-band__title">Ready to sell in {location.city}?</p>
        <Link to={`${g2gPath('offer')}${offerQuery}`} className="g2g-btn g2g-btn--primary">
          Get my cash offer
        </Link>
      </section>
    </div>
  );
}
