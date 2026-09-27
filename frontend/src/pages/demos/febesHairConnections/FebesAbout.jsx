import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, IMAGES } from './constants';
import { febesPath } from './febesBase';

export default function FebesAbout() {
  useEffect(() => {
    document.title = `About — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">About us</h1>
      <p className="febe-section-lead">
        A welcoming salon built on trust, technique, and hair health — right here in Morrow.
      </p>
      <div className="febe-about-split">
        <div>
          <img src={IMAGES.about} alt="Stylist working with a client in the salon" loading="lazy" />
        </div>
        <div>
          <h2 className="febe-section-heading" style={{ textAlign: 'left' }}>
            Our story
          </h2>
          <p>
            {BRAND} was founded to give south metro Atlanta a place where every guest feels seen —
            whether you&apos;re maintaining locs, refreshing color, or treating yourself to a silk press.
          </p>
          <p>
            We invest in ongoing education, premium products, and a team that listens first. No rushed
            appointments — just thoughtful service and results you&apos;re proud to wear.
          </p>
          <ul style={{ color: 'var(--febe-muted)', paddingLeft: '1.2rem' }}>
            <li>Healthy-hair-first philosophy</li>
            <li>Transparent timing and pricing</li>
            <li>Styles that fit your lifestyle</li>
          </ul>
          <p style={{ marginTop: '1.5rem' }}>
            <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
              Book your visit
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
