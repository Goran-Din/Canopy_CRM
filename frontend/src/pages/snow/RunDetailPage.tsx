import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Entry {
  id: string; property_name: string | null; property_address: string | null; service_type: string;
  status: string; crew_name: string | null; arrival_time: string | null; departure_time: string | null;
}
interface Run {
  id: string; run_number: string; run_date: string; trigger_type: string; snowfall_inches: number | null;
  temperature_f: number | null; weather_notes: string | null; status: string;
  start_time: string | null; end_time: string | null; notes: string | null; entries: Entry[];
}

const entryColumns: Column<Entry>[] = [
  { key: 'property_name', header: 'Property', render: (row) => <span className="font-medium">{row.property_name ?? row.property_address ?? '-'}</span> },
  { key: 'service_type', header: 'Service', render: (row) => <span className="text-sm capitalize">{row.service_type.replace(/_/g, ' ')}</span> },
  { key: 'crew_name', header: 'Crew', render: (row) => <span className="text-sm">{row.crew_name ?? '-'}</span> },
  { key: 'arrival_time', header: 'Arrival', render: (row) => <span className="text-sm">{row.arrival_time ?? '-'}</span> },
  { key: 'departure_time', header: 'Departure', render: (row) => <span className="text-sm">{row.departure_time ?? '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

const statusTransitions: Record<string, string[]> = {
  planned: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
};

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: run, isLoading } = useApiGet<Run>(['snow-run', id], `/v1/snow/runs/${id}`, undefined, { enabled: !!id });
  const statusMut = useApiMutation('put', `/v1/snow/runs/${id}`, [['snow-run', id], ['snow-runs']]);

  const changeStatus = (s: string) => {
    statusMut.mutate({ status: s } as never, { onSuccess: () => toast.success(`Run ${s}`), onError: (err) => toast.error(err.response?.data?.message ?? 'Failed') });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!run) return <div className="text-center py-12"><p className="text-muted-foreground">Run not found</p></div>;

  const nextStatuses = statusTransitions[run.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={`Run ${run.run_number}`} description={new Date(run.run_date).toLocaleDateString()} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={run.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Trigger</p><p className="capitalize">{run.trigger_type}</p></div>
            {run.snowfall_inches != null && <div><p className="text-xs text-muted-foreground">Snowfall</p><p>{run.snowfall_inches}"</p></div>}
            {run.temperature_f != null && <div><p className="text-xs text-muted-foreground">Temperature</p><p>{run.temperature_f}°F</p></div>}
            {run.start_time && <div><p className="text-xs text-muted-foreground">Start</p><p>{run.start_time}</p></div>}
            {run.end_time && <div><p className="text-xs text-muted-foreground">End</p><p>{run.end_time}</p></div>}
            {run.weather_notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Weather</p><p>{run.weather_notes}</p></div>}
            {nextStatuses.length > 0 && <div className="pt-2 border-t space-y-2"><p className="text-xs text-muted-foreground">Change Status</p><div className="flex gap-2">{nextStatuses.map((s) => <Button key={s} size="sm" variant={s === 'cancelled' ? 'destructive' : 'outline'} onClick={() => changeStatus(s)} disabled={statusMut.isPending}>{s.replace(/_/g, ' ')}</Button>)}</div></div>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Entries ({run.entries?.length ?? 0})</CardTitle></CardHeader>
          <CardContent><DataTable columns={entryColumns} data={run.entries ?? []} emptyMessage="No entries." /></CardContent>
        </Card>
      </div>
    </div>
  );
}
