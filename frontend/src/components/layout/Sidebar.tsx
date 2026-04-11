import { NavLink } from 'react-router-dom';
import {
  Trees,
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  Briefcase,
  UsersRound,
  Clock,
  Receipt,
  AlertTriangle,
  Snowflake,
  Hammer,
  UserPlus,
  Wrench,
  Package,
  HardHat,
  BookOpen,
  Plug,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'Properties', href: '/properties', icon: MapPin },
      { label: 'Contacts', href: '/contacts', icon: Users },
      { label: 'Prospects', href: '/prospects', icon: UserPlus },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Contracts', href: '/contracts', icon: FileText },
      { label: 'Jobs', href: '/jobs', icon: Briefcase },
      { label: 'Crews', href: '/crews', icon: UsersRound },
      {
        label: 'Dispatch',
        href: '/dispatch',
        icon: LayoutGrid,
        roles: ['owner', 'div_mgr', 'coordinator'],
      },
      {
        label: 'Live Map',
        href: '/live-map',
        icon: MapPin,
        roles: ['owner', 'div_mgr', 'coordinator'],
      },
      { label: 'Time Tracking', href: '/time-tracking', icon: Clock },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Invoices', href: '/invoices', icon: Receipt },
      {
        label: 'Billing',
        href: '/billing',
        icon: Receipt,
        roles: ['owner', 'div_mgr'],
      },
      { label: 'Disputes', href: '/disputes', icon: AlertTriangle },
    ],
  },
  {
    title: 'Specialized',
    items: [
      { label: 'Snow', href: '/snow', icon: Snowflake },
      { label: 'Hardscape', href: '/hardscape', icon: Hammer },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Equipment', href: '/equipment', icon: Wrench },
      { label: 'Materials', href: '/materials', icon: Package },
      { label: 'Subcontractors', href: '/subcontractors', icon: HardHat },
      { label: 'SOPs', href: '/sops', icon: BookOpen },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Reports', href: '/reports', icon: LayoutGrid },
      {
        label: 'Analytics',
        href: '/reports/analytics',
        icon: LayoutGrid,
        roles: ['owner', 'div_mgr'],
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        label: 'Integrations',
        href: '/integrations',
        icon: Plug,
        roles: ['owner'],
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        roles: ['owner'],
      },
      {
        label: 'Templates',
        href: '/settings/templates',
        icon: FileText,
        roles: ['owner', 'div_mgr'],
      },
    ],
  },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles.map((r) => r.role) ?? [];

  function hasAccess(item: NavItem): boolean {
    if (!item.roles) return true;
    return item.roles.some((role) => userRoles.includes(role));
  }

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Trees className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Canopy CRM</span>
      </div>

      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="space-y-1 p-4">
          {navSections.map((section, idx) => {
            const visibleItems = section.items.filter(hasAccess);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {idx > 0 && <Separator className="my-3" />}
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
