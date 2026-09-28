import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AppLayout from './components/AppLayout';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import ConversationsPage from './pages/ConversationsPage';
import SettingsPage from './pages/SettingsPage';
import ContactsPage from './pages/ContactsPage';
import CampaignsPage from './pages/CampaignsPage';
import AutomationsPage from './pages/AutomationsPage';
import PlatformDashboard from './pages/admin/PlatformDashboard';
import TenantListPage from './pages/admin/TenantListPage';
import TenantDetailPage from './pages/admin/TenantDetailPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import PasswordRequestsPage from './pages/admin/PasswordRequestsPage';
import GoldenCrownDemoPage from './pages/demos/GoldenCrownDemoPage';
import G2GLayout from './pages/demos/graceToGrace/G2GLayout';
import G2GHome from './pages/demos/graceToGrace/G2GHome';
import G2GOffer from './pages/demos/graceToGrace/G2GOffer';
import G2GContact from './pages/demos/graceToGrace/G2GContact';
import HomeRedirect from './components/HomeRedirect';
import { G2G_BASE, g2gPath } from './pages/demos/graceToGrace/g2gBase';
import FebesLayout from './pages/demos/febesHairConnections/FebesLayout';
import FebesHome from './pages/demos/febesHairConnections/FebesHome';
import FebesAbout from './pages/demos/febesHairConnections/FebesAbout';
import FebesServices from './pages/demos/febesHairConnections/FebesServices';
import FebesBook from './pages/demos/febesHairConnections/FebesBook';
import FebesGallery from './pages/demos/febesHairConnections/FebesGallery';
import FebesReviews from './pages/demos/febesHairConnections/FebesReviews';
import FebesPromotions from './pages/demos/febesHairConnections/FebesPromotions';
import FebesContact from './pages/demos/febesHairConnections/FebesContact';
import FebesFaq from './pages/demos/febesHairConnections/FebesFaq';
import { FEBES_BASE, febesPath } from './pages/demos/febesHairConnections/febesBase';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/demo/golden-crown-kitchen" element={<GoldenCrownDemoPage />} />
          <Route path={`${G2G_BASE}/*`} element={<G2GLayout />}>
            <Route index element={<G2GHome />} />
            <Route path="offer" element={<G2GOffer />} />
            <Route path="contact" element={<G2GContact />} />
            <Route path="*" element={<Navigate to={g2gPath()} replace />} />
          </Route>

          <Route path={`${FEBES_BASE}/*`} element={<FebesLayout />}>
            <Route index element={<FebesHome />} />
            <Route path="about" element={<FebesAbout />} />
            <Route path="services" element={<FebesServices />} />
            <Route path="book" element={<FebesBook />} />
            <Route path="gallery" element={<FebesGallery />} />
            <Route path="reviews" element={<FebesReviews />} />
            <Route path="promotions" element={<FebesPromotions />} />
            <Route path="contact" element={<FebesContact />} />
            <Route path="faq" element={<FebesFaq />} />
            <Route path="*" element={<Navigate to={febesPath()} replace />} />
          </Route>

          {/* Tenant routes */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="conversations" element={<ConversationsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="retention" element={<Navigate to="/campaigns" replace />} />
            <Route path="automations" element={<AutomationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Super Admin routes */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<PlatformDashboard />} />
            <Route path="tenants" element={<TenantListPage />} />
            <Route path="tenants/:id" element={<TenantDetailPage />} />
            <Route path="password-requests" element={<PasswordRequestsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
