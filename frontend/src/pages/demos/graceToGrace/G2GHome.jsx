import { useEffect, useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND } from './constants';
import {
  CTA_REPEAT,
  FAQ_ITEMS,
  HERO,
  HOW_IT_WORKS_STEPS,
  REVIEWS,
  TRUST_BAND,
  TRUST_CHIPS,
} from './homeContent';

const BASE = '/demo/grace-to-grace';

function StepIcon({ name }) {
  const common = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  switch (name) {
    case 'vin':
      return (
        <svg {...common}>
          <path
            d="M4 7h16v10H4V7zm2 2v6h12V9H6zm2 2h8v2H8v-2z"
            fill="currentColor"
            opacity=".9"
          />
          <path d="M8 5h8v2H8V5z" fill="currentColor" opacity=".5" />
        </svg>
      );
    case 'form':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 9h8M8 12h6M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'range':
      return (
        <svg {...common}>
          <path d="M4 18V6l4 4 4-6 4 5 4-3v12H4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'sell':
      return (
        <svg {...common}>
          <rect x="5" y="7" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path
            d="M8 3h6l4 4v14a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M9 12h6M9 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path
            d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    default:
      return null;
  }
}

function StarRow({ n }) {
  return (
    <span className="g2g-stars" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

export default function G2GHome() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    document.title = `${BRAND} — Vehicle cash offers`;
  }, []);

  useLayoutEffect(() => {
    if (!hash || hash === '#') return;
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pathname, hash]);

  return (
    <div className="g2g-home">
      <section className="g2g-hero g2g-hero--marketing" aria-labelledby="g2g-demo-hero-heading">
        <p className="g2g-hero-eyebrow">Cash offers · junk · damaged · daily drivers</p>
        <h1 id="g2g-demo-hero-heading">{HERO.headline}</h1>
        <p className="g2g-hero-lead">{HERO.subhead}</p>
        <div className="g2g-hero-actions">
          <Link to={`${BASE}/offer`} className="g2g-btn g2g-btn--primary">
            {HERO.primaryCta}
          </Link>
          <Link to={`${BASE}/offer?start=vin`} className="g2g-btn g2g-btn--ghost">
            {HERO.secondaryCta}
          </Link>
        </div>
        <ul className="g2g-trust-chips" role="list">
          {TRUST_CHIPS.map((c) => (
            <li key={c.label}>{c.label}</li>
          ))}
        </ul>
      </section>

      <section className="g2g-section g2g-cta-band" aria-labelledby="g2g-demo-cta-mid-1">
        <h2 id="g2g-demo-cta-mid-1" className="g2g-section-heading g2g-visually-hidden">
          Get started
        </h2>
        <p className="g2g-cta-band__title">{CTA_REPEAT.title}</p>
        <p className="g2g-cta-band__body">{CTA_REPEAT.body}</p>
        <Link to={`${BASE}/offer`} className="g2g-btn g2g-btn--primary">
          {CTA_REPEAT.button}
        </Link>
      </section>

      <section id="how-it-works" className="g2g-section g2g-section--surface">
        <h2 className="g2g-section-heading">How it works</h2>
        <p className="g2g-section-lead">Four quick steps from your details to your offer.</p>
        <ol className="g2g-steps">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <li key={step.title} className="g2g-step">
              <div className="g2g-step__icon" aria-hidden>
                <StepIcon name={step.icon} />
              </div>
              <span className="g2g-step__num">{i + 1}</span>
              <h3 className="g2g-step__title">{step.title}</h3>
              <p className="g2g-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="reviews" className="g2g-section">
        <h2 className="g2g-section-heading">What sellers say</h2>
        <p className="g2g-section-lead">Examples shared with us — your experience will vary by vehicle and market.</p>
        <div className="g2g-review-grid">
          {REVIEWS.map((r) => (
            <blockquote key={r.name} className="g2g-review-card">
              <StarRow n={r.rating} />
              <p className="g2g-review-quote">&ldquo;{r.quote}&rdquo;</p>
              <footer>
                <strong className="g2g-review-name">{r.name}</strong>
                <span className="g2g-review-meta">{r.meta}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="g2g-section g2g-cta-band g2g-cta-band--compact" aria-labelledby="g2g-demo-cta-mid-2">
        <h2 id="g2g-demo-cta-mid-2" className="g2g-visually-hidden">
          Get offer
        </h2>
        <p className="g2g-cta-band__title">Ready to see numbers?</p>
        <Link to={`${BASE}/offer`} className="g2g-btn g2g-btn--primary">
          {HERO.primaryCta}
        </Link>
      </section>

      <section id="trust" className="g2g-section g2g-section--surface">
        <h2 className="g2g-section-heading">Why use {BRAND}?</h2>
        <p className="g2g-section-lead">Built for clarity — especially when your car isn&apos;t showroom fresh.</p>
        <div className="g2g-trust-grid">
          {TRUST_BAND.map((item) => (
            <div key={item.title} className="g2g-trust-item">
              <div className="g2g-step__icon g2g-step__icon--sm" aria-hidden>
                <StepIcon name={item.icon} />
              </div>
              <h3 className="g2g-trust-item__title">{item.title}</h3>
              <p className="g2g-trust-item__body">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="g2g-section">
        <h2 className="g2g-section-heading">FAQ</h2>
        <p className="g2g-section-lead">Common questions about your offer and how we follow up.</p>
        <div className="g2g-faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="g2g-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="g2g-disclaimer g2g-muted-block">
        {BRAND} demo platform — estimates are for illustration only. Final purchase offers require inspection, title
        verification, and local compliance.
      </p>

      <aside className="g2g-sticky-cta" aria-label="Get offer">
        <Link to={`${BASE}/offer`} className="g2g-btn g2g-btn--primary g2g-sticky-cta__btn">
          {HERO.primaryCta}
        </Link>
      </aside>
    </div>
  );
}
