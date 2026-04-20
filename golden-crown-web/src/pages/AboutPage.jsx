import { useEffect } from 'react';
import { FEATURED_DISH } from '../constants.js';

export default function AboutPage() {
  useEffect(() => {
    document.title = 'About — Golden Crown Kitchen';
  }, []);

  return (
    <main className="gck-page">
      <header className="gck-page-header">
        <p className="gck-eyebrow">About us</p>
        <h1>Family flavor, Atlanta heart</h1>
        <p className="gck-page-lead">
          Golden Crown Kitchen brings West African comfort food to South Atlanta — cooked fresh daily, seasoned with
          care, and served with the warmth of home.
        </p>
      </header>

      <div className="gck-about-grid gck-about-grid--page">
        <div className="gck-about-copy">
          <p>
            We started with a simple idea: neighbors deserve <strong>real, scratch-made dishes</strong> without
            compromise — from smoky jollof to rich egusi and hearty sides you can taste in every bite.
          </p>
          <p>
            Our kitchen focuses on <strong>bold seasoning</strong>, balanced heat, and the kind of portions that
            feel like Sunday dinner — whether you grew up on these flavors or you&apos;re trying them for the first
            time.
          </p>
          <p>
            Whether you&apos;re grabbing a quick pickup between errands or feeding the crew after a long week,
            we&apos;re here to <strong>fill the table with flavor</strong> — one plate at a time.
          </p>
          <p>
            Golden Crown is <strong>family-owned and community-minded</strong>. We&apos;re proud to serve Morrow,
            Clayton County, and everyone who drives in from across the metro for a taste of home.
          </p>
          <p className="gck-about-tagline">Family-owned · Morrow, GA · Pickup &amp; catering</p>
        </div>
        <div className="gck-about-visual">
          <img src={FEATURED_DISH.img} alt="" loading="lazy" width="800" height="600" />
        </div>
      </div>
    </main>
  );
}
