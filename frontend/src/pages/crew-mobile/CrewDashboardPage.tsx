import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, ChevronRight, PlayCircle, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface ClockStatus {
  clocked_in: boolean;
  clock_in_time: string | null;
  total_today: number;
}

interface TodayJob {
  id: string;
  property_name: string;
  property_address: string;
  status: string;
  scheduled_time: string | null;
  service_type: string;
}

interface RouteStop {
  order: number;
  property_name: string;
  property_address: string;
  job_id: string;
  status: string;
}

interface DashboardData {
  clock_status: ClockStatus;
  today_jobs: TodayJob[];
  current_route: { route_name: string; stops: RouteStop[] } | null;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
};

export default function CrewDashboardPage() {
  const navigate = useNavigate();
  const t = useTranslation();

  const { data, isLoading } = useApiGet<DashboardData>(
    ['crew-dashboard'],
    '/v1/crew/dashboard',
  );

  const clockMut = useApiMutation<unknown, { action: string }>(
    'post',
    '/v1/crew/clock',
    [['crew-dashboard']],
  );

  const handleClock = (action: string) => {
    clockMut.mutate({ action }, {
      onSuccess: () => toast.success(action === 'clock_in' ? t.clockedIn : t.clockedOut),
      onError: () => toast.error(t.loginFailed),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const clock = data?.clock_status;
  const jobs = data?.today_jobs ?? [];
  const route = data?.current_route;

  function formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  return (
    <div className="space-y-4">
      {/* Clock In/Out Card */}
      <Card className="border-2">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{t.today}</span>
              </div>
              {clock?.clocked_in ? (
                <div>
                  <p className="text-lg font-bold text-green-600">{t.clockedIn}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.clockedInSince} {clock.clock_in_time ? new Date(clock.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-bold text-muted-foreground">{t.notClockedIn}</p>
                  {clock?.total_today ? (
                    <p className="text-sm text-muted-foreground">{t.today}: {formatMinutes(clock.total_today)}</p>
                  ) : null}
                </div>
              )}
            </div>
            {clock?.clocked_in ? (
              <Button
                size="lg"
                variant="destructive"
                className="h-16 w-32 text-lg font-bold"
                onClick={() => handleClock('clock_out')}
                disabled={clockMut.isPending}
              >
                <StopCircle className="mr-2 h-6 w-6" />
                {t.clockOut}
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-16 w-32 text-lg font-bold"
                onClick={() => handleClock('clock_in')}
                disabled={clockMut.isPending}
              >
                <PlayCircle className="mr-2 h-6 w-6" />
                {t.clockIn}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Jobs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t.todaysJobs}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{t.noJobsToday}</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                  onClick={() => navigate(`/crew/jobs/${job.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold truncate">{job.property_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{job.property_address}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[job.status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{job.service_type?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Route */}
      {route && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t.currentRoute}</CardTitle>
            <p className="text-sm text-muted-foreground">{route.route_name}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {route.stops.map((stop) => (
                <div
                  key={stop.order}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/crew/jobs/${stop.job_id}`)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {stop.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{stop.property_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{stop.property_address}</p>
                  </div>
                  <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
