import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface TimesheetDay { date: string; total_minutes: number; entries: Array<{ id: string; clock_in: string; clock_out: string | null; total_minutes: number | null; status: string }> }
interface TimesheetData { days: TimesheetDay[]; total_minutes: number; user_name: string }

function getWeekStart(offset: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.toISOString().split('T')[0];
}

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatHours(mins: number): string {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function TimesheetPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);

  const { data: timesheet, isLoading } = useApiGet<TimesheetData>(
    ['timesheet', weekStart],
    '/v1/time-entries/my-timesheet',
    { date_from: weekStart, date_to: (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0]; })() },
  );

  const approveMut = useApiMutation<unknown, { entryId: string }>('put', (vars) => `/v1/time-entries/${vars.entryId}`, [['timesheet', weekStart], ['time-entries']]);

  const approveEntry = (entryId: string) => {
    approveMut.mutate({ entryId, status: 'approved' } as never, {
      onSuccess: () => toast.success('Entry approved'),
      onError: () => toast.error('Failed to approve'),
    });
  };

  const isManager = user?.roles.some((r) => ['owner', 'div_mgr'].includes(r.role));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/time-tracking')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title="Timesheet" description={timesheet?.user_name ?? 'My Timesheet'} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>This Week</Button>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight className="h-4 w-4" /></Button>
        <span className="ml-2 text-sm text-muted-foreground">Week of {new Date(weekStart).toLocaleDateString()}</span>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Weekly Hours</CardTitle>
              <span className="text-lg font-bold text-primary">{formatHours(timesheet?.total_minutes ?? 0)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Entries</TableHead>
                  {isManager && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(timesheet?.days ?? []).map((day, i) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">{dayNames[i] ?? '-'}</TableCell>
                    <TableCell>{new Date(day.date).toLocaleDateString()}</TableCell>
                    <TableCell className={day.total_minutes > 0 ? 'font-medium' : 'text-muted-foreground'}>{day.total_minutes > 0 ? formatHours(day.total_minutes) : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {day.entries.map((e) => <StatusBadge key={e.id} status={e.status} className="text-[10px]" />)}
                      </div>
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        {day.entries.filter((e) => e.status === 'clocked_out').map((e) => (
                          <Button key={e.id} size="sm" variant="outline" onClick={() => approveEntry(e.id)} disabled={approveMut.isPending}>
                            Approve
                          </Button>
                        ))}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
