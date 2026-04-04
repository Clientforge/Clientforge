import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AdminNavItems({ onNavigate }) {
  const close = onNavigate || (() => {});

  return (
    <>
      <NavLink to="/admin" end onClick={close} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>
        Platform Overview
      </NavLink>
      <NavLink to="/admin/tenants" onClick={close} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Businesses
      </NavLink>
    </>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [navOpen]);

  const handleLogout = () => {
    setNavOpen(false);
    logout();
    navigate('/admin/login');
  };

  const closeNav = () => setNavOpen(false);

  return (
    <div className={`app-layout admin-app-layout${navOpen ? ' nav-open' : ''}`}>
      <header className="mobile-app-header mobile-admin-header">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" aria-hidden><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          )}
        </button>
        <span className="mobile-app-title">ClientForge <span className="brand-admin">Admin</span></span>
      </header>

      <button type="button" className="sidebar-backdrop" aria-label="Close menu" tabIndex={navOpen ? 0 : -1} onClick={closeNav} />

      <aside className="sidebar admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#asg)" />
              <path d="M8 14l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="asg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#dc2626" /><stop offset="1" stopColor="#f59e0b" /></linearGradient></defs>
            </svg>
          </div>
          <span>ClientForge <span className="brand-admin">Admin</span></span>
        </div>

        <nav className="sidebar-nav">
          <AdminNavItems onNavigate={closeNav} />
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar admin-avatar">SA</div>
            <div className="user-meta">
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-tenant">Super Admin</div>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout} aria-label="Log out">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
