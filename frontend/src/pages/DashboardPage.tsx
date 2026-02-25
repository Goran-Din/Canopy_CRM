import { useAuthStore } from '@/stores/authStore';
import OwnerDashboard from './OwnerDashboard';
import DivisionDashboard from './DivisionDashboard';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles.map((r) => r.role) ?? [];

  if (roles.includes('owner')) {
    return <OwnerDashboard />;
  }

  return <DivisionDashboard />;
}
