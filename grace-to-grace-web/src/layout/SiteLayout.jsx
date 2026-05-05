import { useCallback, useEffect, useId, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import '../styles/app.css';

function navClass({ isActive }) {
  return isActive ? 'g2g-nav--active' : '';
}

export default function SiteLayout() {
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
    <div className="g2g-shell">
      <header className="g2g-header">
        <div className="g2g-header-inner">
          <Link to="/" className="g2g-logo" onClick={closeMenu}>
            Grace <span>to</span> Grace
          </Link>
          <button
            type="button"
            className="g2g-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M6 18L18 6M6 6l12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <nav className="g2g-nav g2g-nav--desktop" aria-label="Primary">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <Link to="/#how-it-works" className="g2g-nav-hash">
              How it works
            </Link>
            <Link to="/#reviews" className="g2g-nav-hash">
              Reviews
            </Link>
            <Link to="/#faq" className="g2g-nav-hash">
              FAQ
            </Link>
            <NavLink to="/contact" className={navClass}>
              Contact
            </NavLink>
            <NavLink to="/offer" className={(p) => `g2g-nav-cta ${navClass(p)}`.trim()}>
              Get offer
            </NavLink>
          </nav>
          {menuOpen ? (
            <button
              type="button"
              className="g2g-nav-backdrop"
              tabIndex={-1}
              aria-hidden
              onClick={closeMenu}
            />
          ) : null}
          <div
            id={menuId}
            className={`g2g-nav-mobile${menuOpen ? ' g2g-nav-mobile--open' : ''}`}
            aria-hidden={!menuOpen}
          >
            <NavLink to="/" end className={navClass} onClick={closeMenu}>
              Home
            </NavLink>
            <Link to="/#how-it-works" className="g2g-nav-hash" onClick={closeMenu}>
              How it works
            </Link>
            <Link to="/#faq" className="g2g-nav-hash" onClick={closeMenu}>
              FAQ
            </Link>
            <NavLink to="/contact" className={navClass} onClick={closeMenu}>
              Contact now
            </NavLink>
          </div>
        </div>
      </header>
      <main className="g2g-main">
        <Outlet />
      </main>
    </div>
  );
}
