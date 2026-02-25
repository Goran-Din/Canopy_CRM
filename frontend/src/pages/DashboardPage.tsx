import { useNavigate } from 'react-router-dom';
import { Trees, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../api/client';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // proceed with local logout even if API call fails
    }
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Trees className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Canopy CRM</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.first_name} {user?.last_name}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary">Welcome to Canopy CRM</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {user ? `Hello, ${user.first_name} ${user.last_name}` : 'Loading...'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 1 — Foundation complete
          </p>
        </div>
      </main>
    </div>
  );
}
