import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Clock, User } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { useTranslation } from '@/hooks/useTranslation';

const tabs = [
  { labelKey: 'dashboard' as const, path: '/crew/dashboard', icon: LayoutDashboard },
  { labelKey: 'jobs' as const, path: '/crew/dashboard', icon: Briefcase },
  { labelKey: 'timesheet' as const, path: '/crew/timesheet', icon: Clock },
  { labelKey: 'profile' as const, path: '/crew/profile', icon: User },
];

export function CrewMobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card z-50">
        <div className="flex h-16">
          {tabs.map((tab) => {
            const isActive =
              (tab.labelKey === 'dashboard' && location.pathname === '/crew/dashboard') ||
              (tab.labelKey === 'jobs' && location.pathname.startsWith('/crew/jobs')) ||
              (tab.labelKey === 'timesheet' && location.pathname === '/crew/timesheet') ||
              (tab.labelKey === 'profile' && location.pathname === '/crew/profile');
            const Icon = tab.icon;
            return (
              <button
                key={tab.labelKey}
                onClick={() => navigate(tab.path)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span>{t[tab.labelKey]}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <Toaster position="top-center" richColors />
    </div>
  );
}
