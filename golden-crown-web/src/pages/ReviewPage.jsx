import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GCK_ADDRESS_LINE, GCK_MAPS_SEARCH_URL } from '../constants.js';
import './ReviewPages.css';

function splitAddress(line) {
  const i = line.indexOf(',');
  if (i === -1) return { street: line, rest: '' };
  return { street: line.slice(0, i).trim(), rest: line.slice(i + 1).trim() };
}

export default function ReviewPage() {
  const { street, rest } = splitAddress(GCK_ADDRESS_LINE);

  useEffect(() => {
    document.title = 'Tell us how we did — Golden Crown Kitchen';
  }, []);

  return (
    <main className="gck-page gck-page--review">
      <div className="gck-review">
        <header className="gck-review-header">
          <p className="gck-review-badge">GOLDENCROWN KITCHEN</p>
          <h1>We&apos;d love to hear about your experience</h1>
          <p className="gck-review-sub">
            Tell us how we did—whether you ordered delivery or sat down with us. Tap a star; it only takes
            a moment.
          </p>
          <p className="gck-review-info">
            <strong>Delivery &amp; pickup</strong> · <strong>Dine-in</strong> · Morrow, GA
          </p>

          <p className="gck-review-star-hint" id="star-label">
            Rate your order or visit
          </p>
          <div className="gck-review-star-row" role="group" aria-labelledby="star-label">
            <Link to="/review/feedback?stars=1" aria-label="1 out of 5 stars">
              ★
            </Link>
            <Link to="/review/feedback?stars=2" aria-label="2 out of 5 stars">
              ★
            </Link>
            <Link to="/review/feedback?stars=3" aria-label="3 out of 5 stars">
              ★
            </Link>
            <Link to="/review/google?stars=4" aria-label="4 out of 5 stars">
              ★
            </Link>
            <Link to="/review/google?stars=5" aria-label="5 out of 5 stars">
              ★
            </Link>
          </div>

          <div className="gck-review-cta-block">
            <a
              className="gck-review-btn-ghost"
              href={GCK_MAPS_SEARCH_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions
            </a>
          </div>
        </header>

        <div className="gck-review-wrap">
          <section className="gck-review-section" aria-labelledby="visit-heading">
            <h2 id="visit-heading">Visit</h2>
            <div className="gck-review-card gck-review-visit">
              <p>
                <strong>{street}</strong>
                {rest ? (
                  <>
                    <br />
                    {rest}
                  </>
                ) : null}
              </p>
              <p className="gck-review-visit-btn">
                <a
                  className="gck-review-btn-ghost"
                  href={GCK_MAPS_SEARCH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              </p>
            </div>
          </section>
        </div>

        <footer className="gck-review-site-footer">
          © {new Date().getFullYear()} GOLDENCROWN KITCHEN
        </footer>
      </div>
    </main>
  );
}
