import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { useApiGet } from '@/hooks/useApi';

interface TimeEntry {
  id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_minutes: number;
  job_property_name: string | null;
}

interface TimesheetData {
  entries: TimeEntry[];
  daily_totals: { date: string; total_minutes: number }[];
  week_total_minutes: number;
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CrewTimesheetPage() {
  const t = useTranslation();
  const { data, isLoading } = useApiGet<TimesheetData>(
    ['crew-timesheet'],
    '/v1/crew/timesheet',
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const weekTotal = data?.week_total_minutes ?? 0;
  const dailyTotals = data?.daily_totals ?? [];
  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t.timesheet}</h1>

      {/* Week Summary */}
      <Card className="border-2">
        <CardContent className="p-5">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">{t.thisWeek}</p>
            <p className="text-4xl font-bold mt-1">{formatMins(weekTotal)}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.totalHours}</p>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.daily}</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyTotals.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {dailyTotals.map((day) => (
                <div key={day.date} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{formatDay(day.date)}</span>
                  <span className="text-sm font-bold">{formatMins(day.total_minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.thisWeek} - {t.time}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {formatTime(entry.clock_in)}
                      {entry.clock_out ? ` - ${formatTime(entry.clock_out)}` : ' - ...'}
                    </p>
                    {entry.job_property_name && (
                      <p className="text-xs text-muted-foreground">{entry.job_property_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDay(entry.date)}</p>
                  </div>
                  <span className="text-sm font-bold">
                    {entry.total_minutes ? formatMins(entry.total_minutes) : '--'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
