import { useCallback, useEffect } from 'react';
import HoursBlock from '../components/HoursBlock.jsx';
import {
  CONTACT_EMAIL,
  CONTACT_FORM_URL,
  GCK_ADDRESS_LINE,
  GCK_INSTAGRAM_URL,
  GCK_PHONE_DISPLAY,
  GCK_PHONE_TEL,
} from '../constants.js';
import { IconArrowRight, IconInstagram } from '../icons.jsx';

export default function ContactPage() {
  useEffect(() => {
    document.title = 'Contact — Golden Crown Kitchen';
  }, []);

  const handleContactSubmit = useCallback(
    (e) => {
      if (CONTACT_FORM_URL) return;
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const inquiry = String(fd.get('inquiry') || 'General');
      const name = String(fd.get('name') || '');
      const email = String(fd.get('email') || '');
      const phone = String(fd.get('phone') || '');
      const message = String(fd.get('message') || '');
      const subject = encodeURIComponent(`Golden Crown Kitchen — ${inquiry}`);
      const body = encodeURIComponent(
        `Inquiry type: ${inquiry}\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`,
      );
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    },
    [CONTACT_EMAIL],
  );

  return (
    <main className="gck-page gck-page--contact">
      <header className="gck-page-header">
        <p className="gck-eyebrow">Contact</p>
        <h1>Let&apos;s talk</h1>
        <p className="gck-page-lead">
          Questions, catering, or a custom order? Send a note — we&apos;ll get back as soon as we can.
        </p>
      </header>

      <div className="gck-contact-panel gck-contact-panel--page">
        <div className="gck-contact-details">
          <p>
            <strong>Phone</strong>
            <br />
            <a href={`tel:${GCK_PHONE_TEL}`}>{GCK_PHONE_DISPLAY}</a>
          </p>
          <p>
            <strong>Email</strong>
            <br />
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
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
          <p>
            <strong>Location</strong>
            <br />
            {GCK_ADDRESS_LINE}
          </p>
          <div className="gck-contact-details-hours">
            <strong>Hours</strong>
            <HoursBlock />
          </div>
        </div>

        <form
          className="gck-contact-form"
          method="POST"
          action={CONTACT_FORM_URL || undefined}
          onSubmit={CONTACT_FORM_URL ? undefined : handleContactSubmit}
        >
          {CONTACT_FORM_URL ? (
            <input type="hidden" name="_subject" value="Golden Crown Kitchen — website inquiry" />
          ) : null}
          <div className="gck-form-row">
            <label className="gck-field" htmlFor="gck-inquiry">
              Inquiry type
            </label>
            <select id="gck-inquiry" name="inquiry" className="gck-input" defaultValue="General" required>
              <option value="General">General question</option>
              <option value="Catering">Catering / event</option>
              <option value="Order">Order help</option>
            </select>
          </div>
          <div className="gck-form-row gck-form-row--split">
            <div>
              <label className="gck-field" htmlFor="gck-name">
                Name
              </label>
              <input id="gck-name" name="name" type="text" className="gck-input" autoComplete="name" required />
            </div>
            <div>
              <label className="gck-field" htmlFor="gck-phone">
                Phone
              </label>
              <input id="gck-phone" name="phone" type="tel" className="gck-input" autoComplete="tel" />
            </div>
          </div>
          <div className="gck-form-row">
            <label className="gck-field" htmlFor="gck-email">
              Email
            </label>
            <input id="gck-email" name="email" type="email" className="gck-input" autoComplete="email" required />
          </div>
          <div className="gck-form-row">
            <label className="gck-field" htmlFor="gck-message">
              Message
            </label>
            <textarea
              id="gck-message"
              name="message"
              className="gck-input gck-input--textarea"
              rows={4}
              placeholder="Tell us about your event, preferred date, or how we can help."
              required
            />
          </div>
          <button type="submit" className="gck-btn-primary gck-btn-primary--wide">
            Send message
            <IconArrowRight />
          </button>
          <p className="gck-contact-alt">
            Or email us directly at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </form>
      </div>
    </main>
  );
}
