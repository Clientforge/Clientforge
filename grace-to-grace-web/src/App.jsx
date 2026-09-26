import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import SiteLayout from './layout/SiteLayout.jsx';
import ContactPage from './pages/ContactPage.jsx';
import HomePage from './pages/HomePage.jsx';
import OfferPage from './pages/OfferPage.jsx';
import OwnerDashboardPage from './pages/OwnerDashboardPage.jsx';
import OwnerLoginPage from './pages/OwnerLoginPage.jsx';

function routerBasename() {
  const raw = import.meta.env.VITE_G2G_ROUTER_BASENAME;
  if (raw === '/' || raw === '' || raw === undefined) {
    return import.meta.env.VITE_G2G_BASE === '/' ? undefined : '/grace-to-grace';
  }
  return raw;
}

export default function App() {
  const basename = routerBasename();
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/offer" element={<OfferPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/owner/login" element={<OwnerLoginPage />} />
          <Route path="/owner" element={<OwnerDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
