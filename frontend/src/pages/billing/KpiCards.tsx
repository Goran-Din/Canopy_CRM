import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface DashboardData {
  invoiced_ytd: number;
  invoiced_count: number;
  collected_ytd: number;
  collected_count: number;
  outstanding: number;
  outstanding_count: number;
  overdue: number;
  overdue_count: number;
  drafts_count: number;
  awaiting_count: number;
  paid_month_count: number;
  hardscape_count: number;
}

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const cards = [
  { key: 'invoiced', label: 'Invoiced YTD', amountField: 'invoiced_ytd', countField: 'invoiced_count', countLabel: 'invoices', border: 'border-t-blue-500' },
  { key: 'collected', label: 'Collected YTD', amountField: 'collected_ytd', countField: 'collected_count', countLabel: 'paid', border: 'border-t-green-500' },
  { key: 'outstanding', label: 'Outstanding', amountField: 'outstanding', countField: 'outstanding_count', countLabel: 'pending', border: 'border-t-amber-500' },
  { key: 'overdue', label: 'Overdue', amountField: 'overdue', countField: 'overdue_count', countLabel: 'invoices', border: 'border-t-red-500' },
] as const;

interface KpiCardsProps { dashboard: DashboardData; }

export function KpiCards({ dashboard }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.key} className={cn('border-t-4', c.border)}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{fmt(dashboard[c.amountField])}</p>
            <p className="text-xs text-muted-foreground mt-1">{dashboard[c.countField]} {c.countLabel}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
