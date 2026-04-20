import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import HoursBlock from '../components/HoursBlock.jsx';
import {
  CONTACT_EMAIL,
  FEATURED_DISH,
  GCK_ADDRESS_LINE,
  GCK_INSTAGRAM_URL,
  GCK_PHONE_DISPLAY,
  GCK_PHONE_TEL,
  HERO_BG,
  OTHER_DISHES,
  REVIEWS,
} from '../constants.js';
import {
  IconArrowRight,
  IconBag,
  IconClock,
  IconInstagram,
  IconLeaf,
  IconVerified,
} from '../icons.jsx';
import { useInView } from '../hooks/useInView.js';
import { useOrder } from '../orderContext.jsx';

export default function HomePage() {
  const { openOrder } = useOrder();
  const [proofRef, proofVisible] = useInView(0.1);
  const [dishesRef, dishesVisible] = useInView(0.08);
  const [visitRef, visitVisible] = useInView(0.1);

  useEffect(() => {
    document.title = 'Golden Crown Kitchen — Authentic African Food in Atlanta';
  }, []);

  return (
    <>
      <section className="gck-hero" aria-label="Hero">
        <div className="gck-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="gck-hero-overlay" />
        <div className="gck-hero-grain" />
        <div className="gck-hero-inner">
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

      <section className="gck-section gck-section--teasers" aria-labelledby="teasers-heading">
        <div className="gck-section-head">
          <p className="gck-eyebrow">Explore</p>
          <h2 id="teasers-heading">More than a meal</h2>
          <p className="gck-lead">
            Learn our story, plan catering for your group, or reach the team — each has its own page.
          </p>
          <div className="gck-divider" />
        </div>
        <div className="gck-teasers-grid">
          <Link to="/about" className="gck-teaser-card">
            <span className="gck-teaser-label">About us</span>
            <h3>Our story &amp; values</h3>
            <p>Who we are, what we cook, and why neighbors keep coming back.</p>
            <span className="gck-teaser-cta">
              Read more <IconArrowRight />
            </span>
          </Link>
          <Link to="/catering" className="gck-teaser-card">
            <span className="gck-teaser-label">Catering</span>
            <h3>Events &amp; offices</h3>
            <p>Trays, headcounts, and menus built around your date and budget.</p>
            <span className="gck-teaser-cta">
              Catering details <IconArrowRight />
            </span>
          </Link>
          <Link to="/contact" className="gck-teaser-card">
            <span className="gck-teaser-label">Contact</span>
            <h3>Questions &amp; quotes</h3>
            <p>Send a message or call — we&apos;ll respond as soon as we can.</p>
            <span className="gck-teaser-cta">
              Contact now <IconArrowRight />
            </span>
          </Link>
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

        <div className="gck-social-proof-review-cta">
          <Link to="/review" className="gck-proof-review-link">
            Leave us a review
            <IconArrowRight />
          </Link>
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
              <br />
              {GCK_ADDRESS_LINE}
            </p>
            <div className="gck-info-hours">
              <strong>Hours</strong>
              <HoursBlock className="gck-hours-table--compact" />
            </div>
            <p>
              <strong>Phone</strong>
              <br />
              <a href={`tel:${GCK_PHONE_TEL}`} style={{ color: 'var(--gck-gold-light)' }}>
                {GCK_PHONE_DISPLAY}
              </a>
            </p>
            <p>
              <strong>Email</strong>
              <br />
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--gck-gold-light)' }}>
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              <strong>Instagram</strong>
              <br />
              <a
                href={GCK_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="gck-contact-social-link"
              >
                <IconInstagram />
                <span>@goldencrownkitchenatl</span>
              </a>
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
    </>
  );
}
