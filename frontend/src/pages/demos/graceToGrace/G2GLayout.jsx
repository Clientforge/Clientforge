import { Link, NavLink, Outlet } from 'react-router-dom';
import './GraceToGraceDemo.css';

const BASE = '/demo/grace-to-grace';

function navClass({ isActive }) {
  return isActive ? 'g2g-nav--active' : '';
}

export default function G2GLayout() {
  return (
    <div className="g2g-demo-root">
      <div className="g2g-shell">
        <header className="g2g-header">
          <div className="g2g-header-inner">
            <Link to={BASE} className="g2g-logo">
              Grace <span>to</span> Grace
            </Link>
            <nav className="g2g-nav" aria-label="Grace to Grace demo">
              <NavLink to={BASE} end className={navClass}>
                Home
              </NavLink>
              <Link to={`${BASE}/#how-it-works`} className="g2g-nav-hash">
                How it works
              </Link>
              <Link to={`${BASE}/#reviews`} className="g2g-nav-hash">
                Reviews
              </Link>
              <Link to={`${BASE}/#faq`} className="g2g-nav-hash">
                FAQ
              </Link>
              <NavLink to={`${BASE}/contact`} className={navClass}>
                Contact
              </NavLink>
              <NavLink to={`${BASE}/offer`} className={(p) => `g2g-nav-cta ${navClass(p)}`.trim()}>
                Get offer
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="g2g-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
