import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Trees } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/api/client';
import { Toaster } from '@/components/ui/sonner';

export function PortalLayout() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // proceed even if API call fails
    }
    clearAuth();
    navigate('/portal/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Trees className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Canopy</span>
            <span className="text-sm text-muted-foreground">Client Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:inline">
              {user?.first_name} {user?.last_name}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 lg:p-6">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
