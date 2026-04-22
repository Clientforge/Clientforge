import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AppLayout from './components/AppLayout';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import ConversationsPage from './pages/ConversationsPage';
import SettingsPage from './pages/SettingsPage';
import ContactsPage from './pages/ContactsPage';
import CampaignsPage from './pages/CampaignsPage';
import PlatformDashboard from './pages/admin/PlatformDashboard';
import TenantListPage from './pages/admin/TenantListPage';
import TenantDetailPage from './pages/admin/TenantDetailPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import GoldenCrownDemoPage from './pages/demos/GoldenCrownDemoPage';
import GraceToGraceDemoPage from './pages/demos/graceToGrace/GraceToGraceDemoPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/demo/golden-crown-kitchen" element={<GoldenCrownDemoPage />} />
          <Route path="/demo/grace-to-grace/*" element={<GraceToGraceDemoPage />} />

          {/* Tenant routes */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="conversations" element={<ConversationsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Super Admin routes */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<PlatformDashboard />} />
            <Route path="tenants" element={<TenantListPage />} />
            <Route path="tenants/:id" element={<TenantDetailPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
