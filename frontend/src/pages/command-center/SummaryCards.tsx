import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, TrendingUp, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SummaryData {
  crews_active: number;
  crews_not_in: number;
  billing_drafts_amount: number;
  billing_drafts_count: number;
  season_completion_pct: number;
  season_pending_count: number;
  feedback_avg_rating: number;
  feedback_response_count: number;
}

interface SummaryCardsProps { summary: SummaryData; }

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Crews Today',
      primary: `${summary.crews_active} active`,
      secondary: summary.crews_not_in > 0 ? `${summary.crews_not_in} not in ⚠️` : 'All crews in',
      alert: summary.crews_not_in > 0,
      icon: Users,
      href: '/live-map',
    },
    {
      title: 'Billing',
      primary: fmt(summary.billing_drafts_amount),
      secondary: summary.billing_drafts_count > 0 ? `${summary.billing_drafts_count} drafts ⚠️` : 'No drafts',
      alert: summary.billing_drafts_count > 0,
      icon: DollarSign,
      href: '/billing',
    },
    {
      title: 'Season',
      primary: `${summary.season_completion_pct}% complete`,
      secondary: `${summary.season_pending_count} pending`,
      alert: false,
      icon: TrendingUp,
      href: '/reports',
    },
    {
      title: 'Feedback',
      primary: `★ ${summary.feedback_avg_rating.toFixed(1)} / 5`,
      secondary: `${summary.feedback_response_count} responses`,
      alert: false,
      icon: Star,
      href: '/reports',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(c.href)}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.title}</p>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold mt-1">{c.primary}</p>
            <p className={cn('text-xs mt-1', c.alert ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              {c.secondary}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
