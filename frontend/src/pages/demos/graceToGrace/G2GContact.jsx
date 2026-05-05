import { useEffect } from 'react';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
  CONTACT_SERVICE_AREA,
  CONTACT_STREET,
  CONTACT_CITY_LINE,
  CONTACT_MAPS_QUERY,
} from './constants';

export default function G2GContact() {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT_MAPS_QUERY)}`;

  useEffect(() => {
    document.title = 'Contact — Grace to Grace';
  }, []);

  return (
    <>
      <h1 className="g2g-page-title">Contact</h1>
      <p className="g2g-page-lead">
        Reach us by phone, email, or in person. We&apos;re here to help with selling your vehicle or any questions
        about our process.
      </p>
      <div className="g2g-contact-grid">
        <div className="g2g-card g2g-contact-card">
          <p className="g2g-contact-card__label">Email</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="g2g-contact-card__link">
            {CONTACT_EMAIL}
          </a>
        </div>
        <div className="g2g-card g2g-contact-card">
          <p className="g2g-contact-card__label">Phone</p>
          <a href={`tel:${CONTACT_PHONE_E164}`} className="g2g-contact-card__link">
            {CONTACT_PHONE_DISPLAY}
          </a>
        </div>
        <div className="g2g-card g2g-contact-card">
          <p className="g2g-contact-card__label">Address</p>
          <p className="g2g-contact-card__address">
            {CONTACT_SERVICE_AREA}
            <br />
            {CONTACT_STREET}
            <br />
            {CONTACT_CITY_LINE}
          </p>
          <a href={mapsHref} className="g2g-btn g2g-btn--ghost g2g-contact-card__maps" target="_blank" rel="noopener noreferrer">
            Get directions
          </a>
        </div>
      </div>
    </>
  );
}
