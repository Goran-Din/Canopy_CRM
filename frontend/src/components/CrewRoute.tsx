import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function CrewRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!accessToken) {
    return <Navigate to="/crew/login" replace />;
  }

  const isCrew = user?.roles.some((r) =>
    ['crew_leader', 'crew_member'].includes(r.role),
  );
  if (!isCrew) {
    return <Navigate to="/crew/login" replace />;
  }

  return <>{children}</>;
}
