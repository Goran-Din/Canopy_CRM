import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle2, Circle, Camera, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { JobFormDialog } from './JobFormDialog';
import { useApiGet, useApiList, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface ChecklistItem { id: string; description: string; is_completed: boolean; sort_order: number }
interface Photo { id: string; photo_url: string; photo_type: string; caption: string | null }
interface TimeEntry { id: string; user_name: string; clock_in: string; clock_out: string | null; total_minutes: number | null; status: string }
interface Job {
  id: string; title: string; status: string; priority: string; division: string; job_type: string;
  customer_id: string; customer_display_name: string; property_id: string; property_name: string | null;
  contract_id: string | null; description: string | null; scheduled_date: string | null;
  scheduled_start_time: string | null; estimated_duration_minutes: number | null; assigned_crew_id: string | null;
  assigned_crew_name: string | null; notes: string | null; completion_notes: string | null;
  checklist_items: ChecklistItem[]; photos: Photo[]; created_at: string;
}

const statusTransitions: Record<string, string[]> = {
  unscheduled: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled', 'skipped'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified'],
};

const timeColumns: Column<TimeEntry>[] = [
  { key: 'user_name', header: 'User', render: (row) => <span className="text-sm font-medium">{row.user_name}</span> },
  { key: 'clock_in', header: 'Clock In', render: (row) => <span className="text-sm">{new Date(row.clock_in).toLocaleString()}</span> },
  { key: 'clock_out', header: 'Clock Out', render: (row) => <span className="text-sm">{row.clock_out ? new Date(row.clock_out).toLocaleString() : 'Active'}</span> },
  { key: 'total_minutes', header: 'Duration', render: (row) => <span className="text-sm">{row.total_minutes ? `${Math.floor(row.total_minutes / 60)}h ${row.total_minutes % 60}m` : '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);

  const { data: job, isLoading } = useApiGet<Job>(['job', id], `/v1/jobs/${id}`, undefined, { enabled: !!id });
  const { data: timeResult } = useApiList<TimeEntry>(['time-entries', 'job', id], '/v1/time-entries', { job_id: id, limit: 50 }, { enabled: !!id });

  const statusMut = useApiMutation('put', `/v1/jobs/${id}/status`, [['jobs'], ['job', id]]);
  const checklistMut = useApiMutation<unknown, { itemId: string; is_completed: boolean }>('put', (vars) => `/v1/jobs/${id}/checklist/${vars.itemId}`, [['job', id]]);

  const changeStatus = (newStatus: string) => {
    statusMut.mutate({ status: newStatus } as never, {
      onSuccess: () => toast.success(`Status: ${newStatus.replace(/_/g, ' ')}`),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const toggleChecklist = (item: ChecklistItem) => {
    checklistMut.mutate({ itemId: item.id, is_completed: !item.is_completed });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!job) return <div className="text-center py-12"><p className="text-muted-foreground">Job not found</p><Button variant="link" onClick={() => navigate('/jobs')}>Back to Jobs</Button></div>;

  const nextStatuses = statusTransitions[job.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={job.title} description={`${job.job_type.replace(/_/g, ' ')} - ${job.division.replace(/_/g, ' ')}`} actions={<Button variant="outline" onClick={() => setShowEdit(true)}><Edit className="mr-2 h-4 w-4" />Edit</Button>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={job.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Customer</p><Link to={`/customers/${job.customer_id}`} className="text-primary hover:underline">{job.customer_display_name}</Link></div>
            {job.property_name && <div><p className="text-xs text-muted-foreground">Property</p><Link to={`/properties/${job.property_id}`} className="text-primary hover:underline">{job.property_name}</Link></div>}
            <div><p className="text-xs text-muted-foreground">Priority</p><StatusBadge status={job.priority} /></div>
            {job.scheduled_date && <div><p className="text-xs text-muted-foreground">Scheduled</p><p>{new Date(job.scheduled_date).toLocaleDateString()}{job.scheduled_start_time ? ` at ${job.scheduled_start_time}` : ''}</p></div>}
            {job.estimated_duration_minutes && <div><p className="text-xs text-muted-foreground">Est. Duration</p><p>{job.estimated_duration_minutes} min</p></div>}
            {job.assigned_crew_name && <div><p className="text-xs text-muted-foreground">Crew</p><p>{job.assigned_crew_name}</p></div>}
            {job.description && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Description</p><p className="whitespace-pre-wrap">{job.description}</p></div>}
            {job.completion_notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Completion Notes</p><p className="whitespace-pre-wrap">{job.completion_notes}</p></div>}

            {nextStatuses.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs text-muted-foreground">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((s) => (
                    <Button key={s} size="sm" variant={s === 'cancelled' || s === 'skipped' ? 'destructive' : 'outline'} onClick={() => changeStatus(s)} disabled={statusMut.isPending}>{s.replace(/_/g, ' ')}</Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="checklist">
            <TabsList>
              <TabsTrigger value="checklist"><CheckCircle2 className="mr-1 h-3 w-3" />Checklist ({job.checklist_items?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="photos"><Camera className="mr-1 h-3 w-3" />Photos ({job.photos?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="time"><Clock className="mr-1 h-3 w-3" />Time ({timeResult?.data.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="checklist" className="mt-4">
              {(!job.checklist_items || job.checklist_items.length === 0) ? <p className="text-sm text-muted-foreground py-4">No checklist items.</p> : (
                <div className="space-y-2">
                  {job.checklist_items.sort((a, b) => a.sort_order - b.sort_order).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50" onClick={() => toggleChecklist(item)}>
                      {item.is_completed ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>{item.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              {(!job.photos || job.photos.length === 0) ? <p className="text-sm text-muted-foreground py-4">No photos.</p> : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {job.photos.map((p) => (
                    <div key={p.id} className="rounded-md border overflow-hidden">
                      <img src={p.photo_url} alt={p.caption ?? ''} className="h-32 w-full object-cover" />
                      <div className="p-2"><StatusBadge status={p.photo_type} />{p.caption && <p className="text-xs text-muted-foreground mt-1">{p.caption}</p>}</div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="time" className="mt-4">
              <DataTable columns={timeColumns} data={timeResult?.data ?? []} emptyMessage="No time entries." />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <JobFormDialog open={showEdit} onOpenChange={setShowEdit} job={job as never} />
    </div>
  );
}
