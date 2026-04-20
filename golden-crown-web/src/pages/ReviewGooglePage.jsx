import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GCK_GOOGLE_REVIEW_URL } from '../constants.js';
import './ReviewPages.css';

function clampStars(n) {
  if (Number.isNaN(n) || n < 4) return 4;
  if (n > 5) return 5;
  return n;
}

export default function ReviewGooglePage() {
  const [searchParams] = useSearchParams();

  const stars = useMemo(() => clampStars(parseInt(searchParams.get('stars'), 10)), [searchParams]);
  const starsDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);

  useEffect(() => {
    document.title = 'Thank you! — Golden Crown Kitchen';
  }, []);

  return (
    <main className="gck-page gck-page--review">
      <div className="gck-review gck-review-panel">
        <div className="gck-review-card gck-review-card--tight gck-review-google-card">
          <h1>We&apos;re so glad you enjoyed it!</h1>
          <div className="gck-review-stars-display" aria-hidden="true">
            {starsDisplay}
          </div>
          <p className="gck-review-lead" style={{ marginBottom: '1rem' }}>
            You chose {stars} out of 5 stars.
          </p>
          <p className="gck-review-lead" style={{ marginBottom: '1.25rem' }}>
            Would you like to leave feedback for us on <strong>Google</strong>? It helps other guests find
            us.
          </p>

          <a
            className="gck-review-google-btn"
            href={GCK_GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Leave a Google review
          </a>
          <p className="gck-review-google-secondary">
            <Link to="/review">← Back to rating</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
