import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface ChecklistItem {
  task: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
}

interface Transition {
  id: string;
  transition_type: string;
  season_year: number;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  checklist: ChecklistItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const typeLabels: Record<string, string> = {
  spring_startup: 'Spring Startup',
  fall_cleanup: 'Fall Cleanup',
  winter_prep: 'Winter Prep',
  spring_to_summer: 'Spring to Summer',
  summer_to_fall: 'Summer to Fall',
};

export default function SeasonalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: transition, isLoading } = useApiGet<Transition>(
    ['seasonal', id],
    `/v1/seasonal/${id}`,
    undefined,
    { enabled: !!id },
  );

  const checklistMut = useApiMutation(
    'patch',
    `/v1/seasonal/${id}/checklist`,
    [['seasonal', id], ['seasonal']],
  );

  const statusMut = useApiMutation(
    'put',
    `/v1/seasonal/${id}`,
    [['seasonal', id], ['seasonal']],
  );

  const toggleItem = (index: number) => {
    if (!transition) return;
    const updated = transition.checklist.map((item, i) =>
      i === index
        ? {
            ...item,
            completed: !item.completed,
            completed_at: !item.completed ? new Date().toISOString() : null,
          }
        : item,
    );
    checklistMut.mutate({ checklist: updated } as never, {
      onSuccess: () => toast.success('Checklist updated'),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const changeStatus = (status: string) => {
    statusMut.mutate({ status } as never, {
      onSuccess: () => toast.success(`Status: ${status}`),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!transition) return <div className="text-center py-12"><p className="text-muted-foreground">Transition not found</p></div>;

  const completedCount = transition.checklist.filter((c) => c.completed).length;
  const totalCount = transition.checklist.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/seasonal')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={typeLabels[transition.transition_type] || transition.transition_type}
          description={`${transition.season_year} - Scheduled ${new Date(transition.scheduled_date).toLocaleDateString()}`}
          actions={
            <div className="flex gap-2">
              {transition.status === 'planned' && (
                <Button size="sm" onClick={() => changeStatus('in_progress')}>Start</Button>
              )}
              {transition.status === 'in_progress' && (
                <Button size="sm" onClick={() => changeStatus('completed')}>Complete</Button>
              )}
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Details</CardTitle>
              <StatusBadge status={transition.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="capitalize">{transition.transition_type.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Season Year</p>
              <p>{transition.season_year}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
              <p>{new Date(transition.scheduled_date).toLocaleDateString()}</p>
            </div>
            {transition.completed_date && (
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p>{new Date(transition.completed_date).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Progress</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs font-medium">{progressPct}%</span>
              </div>
            </div>
            {transition.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{transition.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Checklist ({completedCount}/{totalCount})</CardTitle>
          </CardHeader>
          <CardContent>
            {totalCount === 0 ? (
              <p className="text-sm text-muted-foreground">No checklist items.</p>
            ) : (
              <div className="space-y-1">
                {transition.checklist.map((item, idx) => (
                  <button
                    key={idx}
                    className="flex items-center gap-3 w-full rounded-md p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleItem(idx)}
                    disabled={checklistMut.isPending}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.task}
                      </p>
                      {item.completed_at && (
                        <p className="text-xs text-muted-foreground">
                          Completed {new Date(item.completed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
