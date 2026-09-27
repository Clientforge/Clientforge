import { useCallback, useEffect, useId, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BRAND, PHONE_DISPLAY, PHONE_TEL, ADDRESS_LINE1, ADDRESS_LINE2 } from './constants';
import { febesPath } from './febesBase';
import './febesDemo.css';

const NAV = [
  { to: '', label: 'Home', end: true },
  { to: 'about', label: 'About' },
  { to: 'services', label: 'Services' },
  { to: 'gallery', label: 'Gallery' },
  { to: 'reviews', label: 'Reviews' },
  { to: 'promotions', label: 'Promotions' },
  { to: 'faq', label: 'FAQ' },
  { to: 'contact', label: 'Contact' },
];

function navClass({ isActive }) {
  return isActive ? 'febe-nav--active' : '';
}

export default function FebesLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className="febe-root">
      <div className="febe-shell">
        <header className="febe-header">
          <div className="febe-header-inner">
            <Link to={febesPath()} className="febe-logo" onClick={closeMenu}>
              Febe&apos;s <span>Hair</span> Connections
            </Link>
            <nav className="febe-nav-desktop" aria-label="Main">
              {NAV.map(({ to, label, end }) => (
                <NavLink key={to || 'home'} to={febesPath(to)} end={end} className={navClass}>
                  {label}
                </NavLink>
              ))}
              <Link to={febesPath('book')} className="febe-btn febe-btn--primary febe-btn--sm">
                Book
              </Link>
            </nav>
            <button
              type="button"
              className="febe-nav-toggle"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
          <div
            id={menuId}
            className={`febe-nav-mobile${menuOpen ? ' febe-nav-mobile--open' : ''}`}
            aria-hidden={!menuOpen}
          >
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to || 'home'} to={febesPath(to)} end={end} onClick={closeMenu}>
                {label}
              </NavLink>
            ))}
            <Link to={febesPath('book')} className="febe-btn febe-btn--primary" onClick={closeMenu}>
              Book appointment
            </Link>
          </div>
        </header>

        <main className="febe-main">
          <Outlet />
        </main>

        <footer className="febe-footer">
          <div className="febe-footer-inner">
            <div>
              <h3>{BRAND}</h3>
              <p>
                {ADDRESS_LINE1}
                <br />
                {ADDRESS_LINE2}
              </p>
              <p>
                <a href={`tel:${PHONE_TEL}`}>{PHONE_DISPLAY}</a>
              </p>
            </div>
            <div>
              <p>
                <Link to={febesPath('book')}>Book online</Link>
                {' · '}
                <Link to={febesPath('services')}>Services</Link>
                {' · '}
                <Link to={febesPath('contact')}>Contact</Link>
              </p>
              <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                Demo site by ClientForge.ai — booking is simulated for showcase.
              </p>
            </div>
          </div>
        </footer>

        <aside className="febe-sticky-cta" aria-label="Book">
          <Link to={febesPath('book')} className="febe-btn febe-btn--primary">
            Book appointment
          </Link>
        </aside>
      </div>
    </div>
  );
}
