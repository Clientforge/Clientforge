import { Link, NavLink, Outlet } from 'react-router-dom';
import '../styles/app.css';

function navClass({ isActive }) {
  return isActive ? 'g2g-nav--active' : '';
}

export default function SiteLayout() {
  return (
    <div className="g2g-shell">
      <header className="g2g-header">
        <div className="g2g-header-inner">
          <Link to="/" className="g2g-logo">
            Grace <span>to</span> Grace
          </Link>
          <nav className="g2g-nav" aria-label="Primary">
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
        </div>
      </header>
      <main className="g2g-main">
        <Outlet />
      </main>
    </div>
  );
}
