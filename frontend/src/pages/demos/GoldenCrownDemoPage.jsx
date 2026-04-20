import { useEffect, useState, useCallback, useRef } from 'react';
import './GoldenCrownDemoPage.css';

const CLOVER_DEFAULT_ORDER_URL = 'https://www.clover.com/online-ordering/goldencrown-kitchen-morrow';
const CLOVER_ORDER_URL =
  import.meta.env.VITE_GCK_CLOVER_ORDER_URL || CLOVER_DEFAULT_ORDER_URL;

/** Hero background: frontend/public/hero-golden-crown.png (replace file to change art) */
const HERO_BG = '/hero-golden-crown.png';

const FEATURED_DISH = {
  name: 'Jollof Rice + Chicken',
  desc: 'Smoky party jollof with tender grilled chicken — our #1 seller.',
  img: '/dish-jollof-chicken.jpg',
};

const OTHER_DISHES = [
  {
    name: 'Egusi + Pounded Yam',
    desc: 'Rich melon-seed soup with smooth pounded yam.',
    img: '/dish-egusi-pounded-yam.webp',
  },
  {
    name: 'Asun Meat',
    desc: 'Spicy roasted goat with peppers and onions — smoky, tender, and bold.',
    img: '/dish-asun-meat.webp',
  },
  {
    name: 'Meat Pie',
    desc: 'Buttery pastry filled with seasoned beef.',
    img: '/dish-meat-pie.jpg',
  },
];

const REVIEWS = [
  {
    initials: 'AK',
    name: 'Ashley KernerChristian',
    quote:
      'Rice was perfectly cooked everything is really good I wish it was just a little bit spicier. I ordered the egusi jollof rice and bitter leaf. Since I’ve been pregnant I’ve been craving African food and this is the first place I’ve tried since moving to Georgia and I’ll definitely be back.',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
  {
    initials: 'ET',
    name: 'Eyram Tawia',
    quote:
      'Ayo!!! If you’re looking for really good amazing authentic freshly made Nigerian dishes this is the spot!!!!! I’ve found another legit African food spot my boi !! 😂😂, and it slick is fighting for the number one spot. Definitely top 2.',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
  {
    initials: 'MW',
    name: 'Melodie W',
    quote: 'very delicious, come here once a week for the spinach and fish dish',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
];

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold, rootMargin: '0px 0px -32px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-4 4-6 8-6 12a6 6 0 0012 0c0-4-2-8-6-12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 21V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h12l-1 14H7L6 8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 016 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVerified() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 2.2L18 3l1.2 3.1L22 8l-2.2 2.9L22 14l-3.1 1.2L18 18l-3.1-1.2L12 22l-2.9-2.2L6 18l-3.1 1.2L2 14l2.2-2.9L2 8l3.1-1.2L6 3l3.1 1.2L12 2zm-1.1 13.2l5.3-5.3-1.4-1.4-3.9 3.9-2.5-2.5-1.4 1.4 3.9 3.9z" />
    </svg>
  );
}

export default function GoldenCrownDemoPage() {
  const [orderOpen, setOrderOpen] = useState(false);
  const [navSolid, setNavSolid] = useState(false);

  const [proofRef, proofVisible] = useInView(0.1);
  const [dishesRef, dishesVisible] = useInView(0.08);
  const [visitRef, visitVisible] = useInView(0.1);

  const openOrder = useCallback(() => setOrderOpen(true), []);
  const closeOrder = useCallback(() => setOrderOpen(false), []);

  useEffect(() => {
    document.title = 'Golden Crown Kitchen — Authentic African Food in Atlanta';
    return () => {
      document.title = 'ClientForge.ai';
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
      <nav className={`gck-nav ${navSolid ? 'gck-nav--solid' : ''}`} aria-label="Primary">
        <div className="gck-nav-brand">
          Golden <span>Crown</span>
        </div>
        <button type="button" className="gck-nav-cta" onClick={openOrder}>
          Order
        </button>
      </nav>

      <section className="gck-hero" aria-label="Hero">
        <div className="gck-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="gck-hero-overlay" />
        <div className="gck-hero-grain" />
        <div className="gck-hero-inner">
          <div className="gck-hero-badge">
            <span className="gck-pulse-dot" aria-hidden />
            Open now · Pickup &amp; quick handoff
          </div>
          <h1>Authentic African Food in Atlanta</h1>
          <p className="gck-sub">Fresh. Flavorful. Made Daily.</p>
          <div className="gck-hero-cta-wrap">
            <button type="button" className="gck-btn-primary" onClick={openOrder}>
              Order Now
              <IconArrowRight />
            </button>
            <span className="gck-hero-cta-hint">Most orders ready in 15–25 min</span>
          </div>
          <div className="gck-trust-row">
            <div className="gck-trust-item">
              <IconLeaf />
              Cooked fresh daily
            </div>
            <div className="gck-trust-item">
              <IconClock />
              Fast pickup window
            </div>
            <div className="gck-trust-item">
              <IconBag />
              Secure checkout
            </div>
          </div>
        </div>
      </section>

      <section
        ref={proofRef}
        className={`gck-section gck-reveal ${proofVisible ? 'gck-reveal--visible' : ''}`}
        aria-labelledby="social-proof-heading"
      >
        <div className="gck-section-head">
          <p className="gck-eyebrow">Social proof</p>
          <h2 id="social-proof-heading">Loved by the community</h2>
          <p className="gck-lead">Don&apos;t just take our word for it — neighbors come back for seconds.</p>
          <div className="gck-divider" />
        </div>

        <div className="gck-proof-bar">
          <div className="gck-google-block">
            <div className="gck-google-logo" aria-hidden>
              <span>G</span>
              <span>o</span>
              <span>o</span>
              <span>g</span>
              <span>l</span>
              <span>e</span>
            </div>
            <div>
              <div className="gck-stars" aria-hidden>
                {'\u2605\u2605\u2605\u2605\u2605'}
              </div>
              <div className="gck-rating-num" aria-label="4.6 out of 5 stars">
                4.6 <small>/ 5</small>
              </div>
            </div>
          </div>
          <div className="gck-proof-stats">
            <div className="gck-stat">
              <div className="gck-stat-val">80+</div>
              <div className="gck-stat-label">Reviews</div>
            </div>
            <div className="gck-stat">
              <div className="gck-stat-val">Family</div>
              <div className="gck-stat-label">Owned</div>
            </div>
          </div>
        </div>

        <div className="gck-reviews-track" role="list">
          {REVIEWS.map((r) => (
            <article key={r.name} className="gck-review-card" role="listitem">
              <div className="gck-review-top">
                <div className="gck-review-avatar" aria-hidden>
                  {r.initials}
                </div>
                <div className="gck-review-meta">
                  <p className="gck-review-name">{r.name}</p>
                  <p className="gck-review-verified">
                    <IconVerified /> Google review
                  </p>
                </div>
              </div>
              <p className="gck-review-quote">{r.quote}</p>
              <div className="gck-review-stars" aria-hidden>
                {r.stars}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        ref={dishesRef}
        className={`gck-section gck-reveal ${dishesVisible ? 'gck-reveal--visible' : ''}`}
        aria-labelledby="dishes-heading"
      >
        <div className="gck-section-head">
          <p className="gck-eyebrow">The menu</p>
          <h2 id="dishes-heading">Crowd favorites</h2>
          <p className="gck-lead">Start with what everyone orders — then explore the full menu at checkout.</p>
          <div className="gck-divider" />
        </div>

        <div className="gck-dishes-intro">
          <p>Tap any dish to start your order</p>
        </div>

        <div className="gck-dishes-layout">
          <button
            type="button"
            className="gck-dish-featured"
            onClick={openOrder}
            aria-label={`Order ${FEATURED_DISH.name}`}
          >
            <div className="gck-dish-img-wrap">
              <span className="gck-dish-badge">Chef&apos;s pick</span>
              <img src={FEATURED_DISH.img} alt="" loading="lazy" width="800" height="600" />
            </div>
            <div className="gck-dish-featured-body">
              <h3>{FEATURED_DISH.name}</h3>
              <p>{FEATURED_DISH.desc}</p>
              <span className="gck-dish-cta">
                Add to order <IconArrowRight />
              </span>
            </div>
          </button>

          <div className="gck-dishes-grid">
            {OTHER_DISHES.map((d) => (
              <button
                key={d.name}
                type="button"
                className="gck-dish-card"
                onClick={openOrder}
                aria-label={`Order ${d.name}`}
              >
                <div className="gck-dish-img-wrap">
                  <img src={d.img} alt="" loading="lazy" width="400" height="300" />
                  <span className="gck-dish-hover-label">Order this</span>
                </div>
                <div className="gck-dish-card-body">
                  <h3>{d.name}</h3>
                  <p>{d.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        ref={visitRef}
        className={`gck-section gck-reveal ${visitVisible ? 'gck-reveal--visible' : ''}`}
        aria-labelledby="visit-heading"
      >
        <div className="gck-section-head">
          <p className="gck-eyebrow">Visit</p>
          <h2 id="visit-heading">Find us in Morrow</h2>
          <p className="gck-lead">Grab pickup or swing by — we&apos;re right off the main strip.</p>
          <div className="gck-divider" />
        </div>
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

      <div className="gck-sticky-cta">
        <div className="gck-sticky-inner">
          <button type="button" className="gck-btn-primary" onClick={openOrder}>
            Order Now
            <IconArrowRight />
          </button>
        </div>
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
            <div className="gck-modal-body gck-modal-body--checkout">
              {hasOrderUrl ? (
                <div className="gck-modal-fallback">
                  <p>
                    You&apos;ll finish your order on Clover&apos;s secure checkout in this same window.
                    Use your browser&apos;s <strong>Back</strong> button anytime to return here.
                  </p>
                  <a className="gck-btn-primary" href={CLOVER_ORDER_URL} style={{ textDecoration: 'none' }}>
                    Continue to order
                    <IconArrowRight />
                  </a>
                </div>
              ) : (
                <div className="gck-modal-fallback">
                  <p>
                    Add your Clover (or other) ordering link: set{' '}
                    <code>VITE_GCK_CLOVER_ORDER_URL</code> in <code>frontend/.env</code>, then rebuild.
                  </p>
                  <button type="button" className="gck-btn-primary" onClick={closeOrder}>
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
