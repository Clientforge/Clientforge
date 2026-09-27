import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BRAND,
  ADDRESS_LINE1,
  ADDRESS_LINE2,
  EMAIL,
  HOURS,
  MAPS_EMBED,
  MAPS_LINK,
  PHONE_DISPLAY,
  PHONE_TEL,
  SOCIAL,
} from './constants';
import { febesPath } from './febesBase';

export default function FebesContact() {
  useEffect(() => {
    document.title = `Contact — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">Contact us</h1>
      <div className="febe-about-split">
        <div>
          <div className="febe-card">
            <h2 style={{ fontFamily: 'var(--febe-serif)', marginTop: 0 }}>Visit the salon</h2>
            <p>
              {ADDRESS_LINE1}
              <br />
              {ADDRESS_LINE2}
            </p>
            <p>
              <a href={`tel:${PHONE_TEL}`}>{PHONE_DISPLAY}</a>
              <br />
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </p>
            <p>
              <a href={SOCIAL.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
              {' · '}
              <a href={SOCIAL.facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            </p>
            <p>
              <a href={MAPS_LINK} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </p>
          </div>
          <div className="febe-card" style={{ marginTop: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--febe-serif)', marginTop: 0 }}>Hours</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {HOURS.map((row) => (
                <li key={row.days} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                  <span>{row.days}</span>
                  <span style={{ color: 'var(--febe-muted)' }}>{row.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <p style={{ marginTop: '1.5rem' }}>
            <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
              Book online
            </Link>
          </p>
        </div>
        <div className="febe-map-wrap">
          <iframe
            title="Febe's Hair Connections location"
            src={MAPS_EMBED}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
