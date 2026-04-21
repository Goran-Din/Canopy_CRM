import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useApiGet } from '@/hooks/useApi';
import { SummaryCards } from './SummaryCards';
import { CrewDispatchPanel } from './panels/CrewDispatchPanel';
import { BillingQueuePanel } from './panels/BillingQueuePanel';
import { SeasonProgressPanel } from './panels/SeasonProgressPanel';
import { RecentFeedbackPanel } from './panels/RecentFeedbackPanel';
import type { PayrollCrossCheckResponse, ServiceVerificationResponse } from '@/api/reports-v2';

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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

export default function CommandCenterPage() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.roles.some((r) => r.role === 'owner') ?? false;
  const [currentTime, setCurrentTime] = useState(new Date());
  const today = useMemo(() => isoDate(new Date()), []);
  const week = useMemo(currentWeekRange, []);

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

  // Wave 7 Brief 06 — cross-check flags today (owner-only, endpoint is owner-only)
  const { data: crossCheck } = useApiGet<PayrollCrossCheckResponse>(
    ['cc-cross-check-today', today],
    '/v1/reports/payroll-cross-check',
    { from_date: today, to_date: today, status: 'flagged' },
    { enabled: isOwner, staleTime: 60_000 },
  );

  // Unverified services this week (visible to anyone who can view the report:
  // owner/div_mgr/coordinator). The card itself is just a compact link.
  const { data: unverified } = useApiGet<ServiceVerificationResponse>(
    ['cc-unverified-week', week.from, week.to],
    '/v1/reports/service-verification',
    { from_date: week.from, to_date: week.to, verification: 'unverified' },
    { staleTime: 60_000 },
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

      {/* Cross-check flags today (owner-only) */}
      {isOwner && crossCheck && crossCheck.totals.flagged_count > 0 ? (
        <Link
          to={`/reports/gps/payroll-cross-check?from_date=${today}&to_date=${today}&status=flagged`}
          className="block"
          aria-label="View today's cross-check flags"
        >
          <Card className="border-red-300 bg-red-50 hover:bg-red-100 transition-colors">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-700 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-900">
                  {crossCheck.totals.flagged_count} cross-check flag
                  {crossCheck.totals.flagged_count === 1 ? '' : 's'} today
                </p>
                <p className="text-sm text-red-800">
                  Click to review payroll cross-check differences &gt; 30 min.
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      {/* Summary Cards */}
      {summary && <SummaryCards summary={summary} />}

      {/* Unverified services this week — compact info card (coordinator+) */}
      {unverified ? (
        <Link
          to={`/reports/gps/service-verification?from_date=${week.from}&to_date=${week.to}&verification=unverified`}
          className="block"
          aria-label="View unverified services this week"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              {unverified.totals.unverified === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {unverified.totals.unverified} unverified service
                  {unverified.totals.unverified === 1 ? '' : 's'} this week
                </p>
                <p className="text-sm text-muted-foreground">
                  {unverified.totals.unverified === 0
                    ? 'All services this week verified by GPS.'
                    : 'Click to review services without GPS verification.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : null}

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
