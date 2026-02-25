import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function PortalRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!accessToken) {
    return <Navigate to="/portal/login" replace />;
  }

  const isClient = user?.roles.some((r) => r.role === 'client');
  if (!isClient) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
}
