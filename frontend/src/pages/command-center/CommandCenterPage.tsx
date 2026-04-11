import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useApiGet } from '@/hooks/useApi';
import { SummaryCards } from './SummaryCards';
import { CrewDispatchPanel } from './panels/CrewDispatchPanel';
import { BillingQueuePanel } from './panels/BillingQueuePanel';
import { SeasonProgressPanel } from './panels/SeasonProgressPanel';
import { RecentFeedbackPanel } from './panels/RecentFeedbackPanel';

interface CommandCenterSummary {
  crews_active: number; crews_not_in: number;
  billing_drafts_amount: number; billing_drafts_count: number;
  billing_overdue_amount: number; billing_overdue_count: number;
  season_completion_pct: number; season_pending_count: number;
  feedback_avg_rating: number; feedback_response_count: number;
  jobs_today_total: number; jobs_today_completed: number;
  jobs_today_active: number; jobs_today_scheduled: number;
  jobs_today_unassigned: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function CommandCenterPage() {
  const user = useAuthStore((s) => s.user);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const { data: summary, isLoading, refetch: refetchSummary } = useApiGet<CommandCenterSummary>(
    ['command-center-summary'], '/v1/command-center/summary',
  );

  const { data: crewData, refetch: refetchCrews } = useApiGet<{ positions: any[] }>(
    ['cc-crew-positions'], '/v1/gps-events/live-crew-positions',
  );

  const { data: drafts = [] } = useApiGet<any[]>(
    ['cc-billing-drafts'], '/v1/billing/drafts', { limit: '5' },
  );

  const { data: overdue = [] } = useApiGet<any[]>(
    ['cc-billing-overdue'], '/v1/billing/overdue',
  );

  const { data: seasonData } = useApiGet<any>(
    ['cc-season-summary'], '/v1/service-occurrences/season-summary',
  );

  const { data: feedbackData } = useApiGet<any>(
    ['cc-feedback'], '/v1/feedback', { limit: '3', sort: 'recent' },
  );

  // Auto-refresh crews every 60s
  useEffect(() => {
    const interval = setInterval(refetchCrews, 60000);
    return () => clearInterval(interval);
  }, [refetchCrews]);

  const handleRefresh = () => {
    refetchSummary();
    refetchCrews();
  };

  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const feedback = Array.isArray(feedbackData) ? feedbackData : (feedbackData?.data || []);
  const crewPositions = crewData?.positions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{getGreeting()}, {user?.first_name || 'there'}</h1>
          <p className="text-sm text-muted-foreground">{dateStr} · {timeStr}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && <SummaryCards summary={summary} />}

      {/* Main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrewDispatchPanel crewPositions={crewPositions} summary={summary ?? undefined} />
        <div className="space-y-6">
          <BillingQueuePanel drafts={drafts} overdue={overdue} />
          <SeasonProgressPanel seasonData={seasonData} />
          <RecentFeedbackPanel feedback={feedback} />
        </div>
      </div>
    </div>
  );
}
