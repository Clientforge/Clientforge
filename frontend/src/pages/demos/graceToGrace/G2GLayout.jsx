import { Link, NavLink, Outlet } from 'react-router-dom';

const BASE = '/demo/grace-to-grace';

function navClass({ isActive }) {
  return isActive ? 'g2g-nav--active' : '';
}

export default function G2GLayout() {
  return (
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
            <NavLink to={`${BASE}/offer`} className={navClass}>
              Get offer
            </NavLink>
            <NavLink to={`${BASE}/contact`} className={navClass}>
              Contact
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
