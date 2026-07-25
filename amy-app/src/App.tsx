import { Navigate, Route, Routes } from 'react-router-dom';
import { getAmyToken } from '@/lib/api';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { ClientDetailPage } from '@/pages/ClientDetailPage';
import { NewClientPage } from '@/pages/NewClientPage';
import { EditClientPage } from '@/pages/EditClientPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { NewSessionPage } from '@/pages/NewSessionPage';
import { RbtPage } from '@/pages/RbtPage';
import { NewRbtPage } from '@/pages/NewRbtPage';
import { EditRbtPage } from '@/pages/EditRbtPage';
import { NotesPage } from '@/pages/NotesPage';
import { NewNotePage } from '@/pages/NewNotePage';

function ProtectedRoute() {
  if (!getAmyToken()) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/new" element={<NewClientPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="clients/:id/edit" element={<EditClientPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/new" element={<NewSessionPage />} />
        <Route path="rbt" element={<RbtPage />} />
        <Route path="rbt/new" element={<NewRbtPage />} />
        <Route path="rbt/:id/edit" element={<EditRbtPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="notes/new" element={<NewNotePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
