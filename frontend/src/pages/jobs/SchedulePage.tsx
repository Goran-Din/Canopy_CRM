import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet } from '@/hooks/useApi';

interface ScheduleJob {
  id: string; title: string; status: string; priority: string; scheduled_date: string;
  scheduled_start_time: string | null; customer_display_name: string; assigned_crew_name: string | null;
  division: string; estimated_duration_minutes: number | null;
}

function getWeekDates(offset: number): { start: string; end: string; dates: Date[] } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(dates[0]), end: fmt(dates[6]), dates };
}

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const priorityColors: Record<string, string> = {
  low: 'border-l-gray-400',
  normal: 'border-l-blue-500',
  high: 'border-l-amber-500',
  urgent: 'border-l-red-500',
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [division, setDivision] = useState('all');

  const { start, end, dates } = getWeekDates(weekOffset);

  const params: Record<string, unknown> = { start_date: start, end_date: end };
  if (division !== 'all') params.division = division;

  const { data: jobs, isLoading } = useApiGet<ScheduleJob[]>(['jobs', 'schedule', start, end, division], '/v1/jobs/schedule', params);

  const jobsByDate = (jobs ?? []).reduce<Record<string, ScheduleJob[]>>((acc, j) => {
    const d = j.scheduled_date?.split('T')[0];
    if (d) { acc[d] = acc[d] ?? []; acc[d].push(j); }
    return acc;
  }, {});

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title="Job Schedule" description={`${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Division" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            <SelectItem value="landscaping_maintenance">Maintenance</SelectItem>
            <SelectItem value="landscaping_projects">Projects</SelectItem>
            <SelectItem value="hardscape">Hardscape</SelectItem>
            <SelectItem value="snow_removal">Snow</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {dates.map((date, i) => {
            const key = date.toISOString().split('T')[0];
            const dayJobs = jobsByDate[key] ?? [];
            const isToday = key === today;
            return (
              <div key={key} className={`rounded-md border ${isToday ? 'border-primary bg-primary/5' : ''} min-h-[150px]`}>
                <div className={`px-2 py-1.5 border-b text-center ${isToday ? 'bg-primary/10' : 'bg-muted/50'}`}>
                  <p className="text-xs font-medium">{dayNames[i]}</p>
                  <p className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>{date.getDate()}</p>
                </div>
                <div className="p-1 space-y-1">
                  {dayJobs.map((j) => (
                    <Card key={j.id} className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${priorityColors[j.priority] ?? ''}`} onClick={() => navigate(`/jobs/${j.id}`)}>
                      <CardContent className="p-2">
                        <p className="text-xs font-medium truncate">{j.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{j.customer_display_name}</p>
                        <div className="flex items-center justify-between mt-1">
                          {j.scheduled_start_time && <span className="text-[10px] text-muted-foreground">{j.scheduled_start_time}</span>}
                          <StatusBadge status={j.status} className="text-[10px] px-1 py-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
