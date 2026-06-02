import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../utils/uiMode';

export default function HomeRedirect() {
  const { tenant } = useAuth();
  return <Navigate to={homePath(tenant)} replace />;
}
