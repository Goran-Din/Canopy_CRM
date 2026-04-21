/**
 * /reports — hub page.
 *
 * Category cards grouped under Analytics, Operations, GPS Analytics, Financial.
 * Owner-only cards are locked (show 🔒, disabled) for non-owner users.
 * The V1 financial-tabs content lives at /reports/financial (separate route).
 */
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';

interface ReportCard {
  id: string;
  label: string;
  description: string;
  to: string;
  ownerOnly?: boolean;
}

interface ReportCategory {
  label: string;
  cards: ReportCard[];
}

const CATEGORIES: ReportCategory[] = [
  {
    label: 'Analytics',
    cards: [
      {
        id: 'analytics-dashboard',
        label: 'Analytics Dashboard',
        description: 'V1 revenue & operational charts',
        to: '/reports/analytics',
      },
    ],
  },
  {
    label: 'Operations',
    cards: [
      {
        id: 'season-completion',
        label: 'Season Completion',
        description: 'R-PKG-01 · Service completion by code',
        to: '/reports/operations/season-completion',
      },
      {
        id: 'occurrence-status',
        label: 'Occurrence Status',
        description: 'R-PKG-02 · Drill-down for one service',
        to: '/reports/operations/occurrence-status',
      },
      {
        id: 'skipped-visits',
        label: 'Skipped Visits',
        description: 'R-PKG-03 · Skipped occurrences with billing impact',
        to: '/reports/operations/skipped-visits',
      },
      {
        id: 'tier-performance',
        label: 'Tier Performance',
        description: 'R-PKG-04 · Gold / Silver / Bronze comparison',
        to: '/reports/operations/tier-performance',
        ownerOnly: true,
      },
    ],
  },
  {
    label: 'GPS Analytics',
    cards: [
      {
        id: 'property-visits',
        label: 'Property Visit History',
        description: 'R-GPS-01 · GPS-verified visits per property',
        to: '/reports/gps/property-visits',
      },
      {
        id: 'payroll-cross-check',
        label: 'Payroll Cross-Check',
        description: 'R-GPS-02 · Clocked vs GPS dwell (informational only)',
        to: '/reports/gps/payroll-cross-check',
        ownerOnly: true,
      },
      {
        id: 'service-verification',
        label: 'Service Verification',
        description: 'R-GPS-03 · Which occurrences have GPS proof',
        to: '/reports/gps/service-verification',
      },
      {
        id: 'route-performance',
        label: 'Route Performance',
        description: 'R-GPS-04 · Estimated vs actual dwell time',
        to: '/reports/gps/route-performance',
      },
    ],
  },
  {
    label: 'Financial (V1)',
    cards: [
      {
        id: 'financial-v1',
        label: 'Financial Reports',
        description: 'Revenue, invoice aging, renewals, crew productivity, snow, pipeline, conversion',
        to: '/reports/financial',
      },
    ],
  },
];

function ReportCardTile({ card, locked }: { card: ReportCard; locked: boolean }) {
  const content = (
    <Card
      className={cn(
        'h-full transition-colors',
        locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/50 cursor-pointer',
      )}
      aria-disabled={locked || undefined}
    >
      <CardContent className="pt-6 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{card.label}</h3>
          {locked ? <Lock className="h-4 w-4 text-muted-foreground" aria-label="Owner only" /> : null}
        </div>
        <p className="text-sm text-muted-foreground">{card.description}</p>
      </CardContent>
    </Card>
  );

  if (locked) {
    return <div role="group" aria-label={`${card.label} (owner only)`}>{content}</div>;
  }

  return (
    <Link to={card.to} aria-label={card.label}>
      {content}
    </Link>
  );
}

export default function ReportsHome() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.roles.some((r) => r.role === 'owner') ?? false;

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" description="Analytics, operations, GPS, and financial reports" />

      {CATEGORIES.map((category) => (
        <section key={category.label} aria-label={category.label} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {category.label}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {category.cards.map((card) => (
              <ReportCardTile
                key={card.id}
                card={card}
                locked={!!card.ownerOnly && !isOwner}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
