import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import OrderModal from '../components/OrderModal.jsx';
import { IconArrowRight } from '../icons.jsx';
import { useOrder } from '../orderContext.jsx';
import '../GoldenCrownDemoPage.css';

function navLinkClass({ isActive }) {
  return `gck-nav-link${isActive ? ' gck-nav-link--active' : ''}`;
}

export default function SiteLayout() {
  const { openOrder } = useOrder();
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="gck-demo">
      <nav className={`gck-nav ${navSolid ? 'gck-nav--solid' : ''}`} aria-label="Primary">
        <Link to="/" className="gck-nav-brand">
          Golden <span>Crown</span>
        </Link>
        <div className="gck-nav-right">
          <div className="gck-nav-links">
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <NavLink to="/catering" className={navLinkClass}>
              Catering
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
          </div>
          <button type="button" className="gck-nav-cta" onClick={openOrder}>
            Order
          </button>
        </div>
      </nav>

      <Outlet />

      <p className="gck-footer-note">
        Demo site for Golden Crown Kitchen — not the final production website.
      </p>

      <div className="gck-sticky-cta">
        <div className="gck-sticky-inner">
          <button type="button" className="gck-btn-primary" onClick={openOrder}>
            Order Now
            <IconArrowRight />
          </button>
        </div>
      </div>

      <OrderModal />
    </div>
  );
}
