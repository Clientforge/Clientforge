import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import SiteLayout from './layout/SiteLayout.jsx';
import ContactPage from './pages/ContactPage.jsx';
import HomePage from './pages/HomePage.jsx';
import OfferPage from './pages/OfferPage.jsx';
import OwnerDashboardPage from './pages/OwnerDashboardPage.jsx';
import OwnerLoginPage from './pages/OwnerLoginPage.jsx';

export default function App() {
  return (
    <BrowserRouter basename="/grace-to-grace">
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
