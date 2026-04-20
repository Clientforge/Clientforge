import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CONTACT_EMAIL } from '../constants.js';
import './ReviewPages.css';

function clampStars(n) {
  if (Number.isNaN(n) || n < 1 || n > 3) return 1;
  return n;
}

export default function ReviewFeedbackPage() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const stars = useMemo(() => clampStars(parseInt(searchParams.get('stars'), 10)), [searchParams]);

  useEffect(() => {
    document.title = 'Your feedback — Golden Crown Kitchen';
  }, []);

  const starsDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const msg = message.trim();
      if (!msg) return;
      const subject = encodeURIComponent(`GOLDENCROWN KITCHEN feedback (${stars} stars)`);
      const body = encodeURIComponent(`Rating: ${stars} / 5 stars\n\n${msg}`);
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      setSubmitted(true);
    },
    [message, stars],
  );

  return (
    <main className="gck-page gck-page--review">
      <div className="gck-review gck-review-panel">
        {!submitted ? (
          <div className="gck-review-card gck-review-card--feedback">
            <h1>We&apos;re sorry we missed the mark</h1>
            <div className="gck-review-stars-display" aria-hidden="true">
              {starsDisplay}
            </div>
            <p className="gck-review-meta">You chose {stars} out of 5 stars.</p>
            <p className="gck-review-meta">Your notes go to our team so we can improve.</p>

            <form onSubmit={handleSubmit}>
              <label className="gck-review-label" htmlFor="review-feedback-message">
                What could we do better?
              </label>
              <textarea
                id="review-feedback-message"
                name="message"
                className="gck-review-textarea"
                required
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                placeholder="Share as much detail as you’re comfortable with…"
                autoComplete="off"
              />
              <button type="submit" className="gck-review-submit">
                Send feedback
              </button>
            </form>
            <p className="gck-review-back">
              <Link to="/review">← Back to rating</Link>
            </p>
          </div>
        ) : (
          <div className="gck-review-card gck-review-card--feedback">
            <div className="gck-review-thanks">
              <h2>Thank you</h2>
              <p className="gck-review-meta" style={{ marginBottom: 0 }}>
                We read every message and take it seriously.
              </p>
              <p className="gck-review-back">
                <Link to="/review">← Back</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
