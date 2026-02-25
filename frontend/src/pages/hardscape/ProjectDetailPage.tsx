import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Milestone { id: string; milestone_name: string; status: string; due_date: string | null; completed_date: string | null; payment_amount: string | null; payment_status: string }
interface StageHistory { id: string; stage: string; notes: string | null; created_at: string; changed_by_name: string | null }
interface Project {
  id: string; project_number: string; title: string; status: string; project_type: string; description: string | null;
  customer_id: string; customer_display_name: string; property_id: string; property_name: string | null;
  estimated_value: string | null; actual_value: string | null; estimated_start_date: string | null;
  actual_start_date: string | null; estimated_end_date: string | null; actual_end_date: string | null;
  assigned_to_name: string | null; source: string | null; notes: string | null;
  milestones: Milestone[]; stage_history: StageHistory[];
}

function fmt(v: string | null): string { if (!v) return '-'; return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v)); }

const stages = ['lead', 'estimate_scheduled', 'estimate_sent', 'negotiation', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled', 'lost'];

const milestoneColumns: Column<Milestone>[] = [
  { key: 'milestone_name', header: 'Milestone', render: (row) => <span className="font-medium">{row.milestone_name}</span> },
  { key: 'due_date', header: 'Due', render: (row) => <span className="text-sm">{row.due_date ? new Date(row.due_date).toLocaleDateString() : '-'}</span> },
  { key: 'payment_amount', header: 'Payment', render: (row) => <span className="text-sm">{fmt(row.payment_amount)}</span> },
  { key: 'payment_status', header: 'Pay Status', render: (row) => <StatusBadge status={row.payment_status} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: project, isLoading } = useApiGet<Project>(['hardscape-project', id], `/v1/hardscape/projects/${id}`, undefined, { enabled: !!id });
  const stageMut = useApiMutation('put', `/v1/hardscape/projects/${id}/stage`, [['hardscape-project', id], ['hardscape-projects']]);

  const changeStage = (stage: string) => {
    stageMut.mutate({ stage } as never, { onSuccess: () => toast.success(`Stage: ${stage.replace(/_/g, ' ')}`), onError: (err) => toast.error(err.response?.data?.message ?? 'Failed') });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!project) return <div className="text-center py-12"><p className="text-muted-foreground">Project not found</p></div>;

  const currentIdx = stages.indexOf(project.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/hardscape')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={project.title} description={project.project_number} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={project.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Customer</p><Link to={`/customers/${project.customer_id}`} className="text-primary hover:underline">{project.customer_display_name}</Link></div>
            {project.property_name && <div><p className="text-xs text-muted-foreground">Property</p><Link to={`/properties/${project.property_id}`} className="text-primary hover:underline">{project.property_name}</Link></div>}
            <div><p className="text-xs text-muted-foreground">Type</p><p className="capitalize">{project.project_type.replace(/_/g, ' ')}</p></div>
            <div><p className="text-xs text-muted-foreground">Estimated</p><p>{fmt(project.estimated_value)}</p></div>
            {project.actual_value && <div><p className="text-xs text-muted-foreground">Actual</p><p>{fmt(project.actual_value)}</p></div>}
            {project.assigned_to_name && <div><p className="text-xs text-muted-foreground">Assigned</p><p>{project.assigned_to_name}</p></div>}
            {project.description && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Description</p><p className="whitespace-pre-wrap">{project.description}</p></div>}

            <div className="pt-2 border-t space-y-2">
              <p className="text-xs text-muted-foreground">Change Stage</p>
              <div className="flex flex-wrap gap-1">
                {stages.filter((_, i) => Math.abs(i - currentIdx) === 1 || ['cancelled', 'lost'].includes(stages[i])).map((s) => (
                  <Button key={s} size="sm" variant={['cancelled', 'lost'].includes(s) ? 'destructive' : 'outline'} onClick={() => changeStage(s)} disabled={stageMut.isPending} className="text-xs">
                    {s.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
            <CardContent><DataTable columns={milestoneColumns} data={project.milestones ?? []} emptyMessage="No milestones." /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Stage History</CardTitle></CardHeader>
            <CardContent>
              {(project.stage_history ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No history.</p> : (
                <div className="space-y-3">
                  {project.stage_history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      <div><StatusBadge status={h.stage} className="text-xs" /><p className="text-xs text-muted-foreground mt-0.5">{new Date(h.created_at).toLocaleString()}{h.changed_by_name ? ` by ${h.changed_by_name}` : ''}</p>{h.notes && <p className="text-xs mt-0.5">{h.notes}</p>}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
