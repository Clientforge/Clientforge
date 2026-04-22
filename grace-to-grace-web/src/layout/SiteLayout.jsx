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
            <NavLink to="/offer" className={navClass}>
              Get offer
            </NavLink>
            <NavLink to="/contact" className={navClass}>
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
