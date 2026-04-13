import { useEffect, useState, useCallback } from 'react';
import './GoldenCrownDemoPage.css';

/**
 * Clover / online ordering URL. Set VITE_GCK_CLOVER_ORDER_URL in frontend/.env for production.
 */
const CLOVER_ORDER_URL = import.meta.env.VITE_GCK_CLOVER_ORDER_URL || '';

const HERO_BG =
  'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=2400&q=80';

const DISHES = [
  {
    name: 'Jollof Rice + Chicken',
    desc: 'Smoky party jollof with tender grilled chicken — our #1 seller.',
    img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Egusi + Pounded Yam',
    desc: 'Rich melon-seed soup with smooth pounded yam. Comfort in a bowl.',
    img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Suya',
    desc: 'Spiced grilled beef with onions — street-food flavor, restaurant quality.',
    img: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Meat Pie',
    desc: 'Buttery pastry filled with seasoned beef — perfect for lunch on the go.',
    img: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80',
  },
];

export default function GoldenCrownDemoPage() {
  const [orderOpen, setOrderOpen] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const openOrder = useCallback(() => setOrderOpen(true), []);
  const closeOrder = useCallback(() => setOrderOpen(false), []);

  useEffect(() => {
    document.title = 'Golden Crown Kitchen — Authentic Nigerian Food in Morrow';
    return () => {
      document.title = 'ClientForge.ai';
    };
  }, []);

  useEffect(() => {
    if (!orderOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeOrder();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [orderOpen, closeOrder]);

  const hasOrderUrl = Boolean(CLOVER_ORDER_URL && CLOVER_ORDER_URL.startsWith('http'));

  return (
    <div className="gck-demo">
      <section className="gck-hero" style={{ backgroundImage: `url(${HERO_BG})` }}>
        <div className="gck-hero-inner">
          <h1>Authentic Nigerian Food in Morrow</h1>
          <p className="gck-sub">Fresh. Flavorful. Made Daily.</p>
          <button type="button" className="gck-btn-primary" onClick={openOrder}>
            Order Now
          </button>
        </div>
      </section>

      <section className="gck-section" aria-labelledby="social-proof-heading">
        <h2 id="social-proof-heading">Loved by the community</h2>
        <p className="gck-lead">Real flavors. Real portions. Real regulars.</p>
        <div className="gck-rating" aria-label="Google rating demo">
          <span aria-hidden>⭐</span>
          <span>4.4/5 on Google</span>
        </div>
        <div className="gck-reviews">
          <blockquote className="gck-review">Best jollof in Atlanta.</blockquote>
          <blockquote className="gck-review">Portions are huge.</blockquote>
          <blockquote className="gck-review">Tastes like home.</blockquote>
        </div>
      </section>

      <section className="gck-section" aria-labelledby="dishes-heading">
        <h2 id="dishes-heading">Popular dishes</h2>
        <p className="gck-lead">A taste of what we&apos;re known for — order your favorites online.</p>
        <div className="gck-dishes">
          {DISHES.map((d) => (
            <article key={d.name} className="gck-dish">
              <img src={d.img} alt="" loading="lazy" width="400" height="300" />
              <div className="gck-dish-body">
                <h3>{d.name}</h3>
                <p>{d.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="gck-section" aria-labelledby="visit-heading">
        <h2 id="visit-heading">Visit us</h2>
        <p className="gck-lead">Pick up in person or order ahead — we&apos;re easy to find.</p>
        <div className="gck-location-grid">
          <div className="gck-info-block">
            <p>
              <strong>Address</strong>
              1230 Lake City Plaza Dr, Morrow, GA 30260
              <span className="gck-demo-note"> (demo address — replace for go-live)</span>
            </p>
            <p>
              <strong>Hours</strong>
              Mon–Thu 11am–9pm · Fri–Sat 11am–10pm · Sun 12pm–8pm
            </p>
            <p>
              <strong>Phone</strong>
              <a href="tel:+14045550123" style={{ color: 'var(--gck-gold-light)' }}>
                (404) 555-0123
              </a>
              <span className="gck-demo-note"> (demo)</span>
            </p>
          </div>
          <div className="gck-map-wrap">
            <iframe
              title="Map — Morrow, GA"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=Morrow%2C%20GA&output=embed"
            />
          </div>
        </div>
      </section>

      <p className="gck-footer-note">
        Demo site for Golden Crown Kitchen — not the final production website.
      </p>

      <div className="gck-sticky-cta">
        <button type="button" className="gck-btn-primary" onClick={openOrder}>
          Order Now
        </button>
      </div>

      {orderOpen && (
        <div
          className="gck-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOrder();
          }}
        >
          <div
            className="gck-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gck-order-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gck-modal-header">
              <span id="gck-order-title">Order — Golden Crown Kitchen</span>
              <button
                type="button"
                className="gck-modal-close"
                onClick={closeOrder}
                aria-label="Close ordering"
              >
                ×
              </button>
            </div>
            <div className="gck-modal-body">
              {hasOrderUrl && !iframeBlocked ? (
                <iframe
                  title="Online ordering"
                  src={CLOVER_ORDER_URL}
                  onError={() => setIframeBlocked(true)}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : null}
              {hasOrderUrl && iframeBlocked ? (
                <div className="gck-modal-fallback">
                  <p>
                    This ordering page can&apos;t be embedded here (the provider may block iframes).
                    Use the button below to order in a new tab.
                  </p>
                  <a
                    className="gck-btn-primary"
                    href={CLOVER_ORDER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    Open ordering
                  </a>
                </div>
              ) : null}
              {!hasOrderUrl ? (
                <div className="gck-modal-fallback">
                  <p>
                    Add your Clover (or other) ordering link: set{' '}
                    <code>VITE_GCK_CLOVER_ORDER_URL</code> in <code>frontend/.env</code>, then rebuild.
                  </p>
                  <button type="button" className="gck-btn-primary" onClick={closeOrder}>
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
