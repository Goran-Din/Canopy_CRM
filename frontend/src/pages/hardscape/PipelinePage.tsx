import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/shared/PageHeader';

import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface PipelineProject {
  id: string; title: string; project_number: string; status: string; customer_display_name: string;
  estimated_value: string | null; project_type: string;
}

interface PipelineData {
  [stage: string]: { count: number; total_value: number; projects: PipelineProject[] };
}

const stageOrder = ['lead', 'estimate_scheduled', 'estimate_sent', 'negotiation', 'approved', 'in_progress', 'on_hold'];
const stageColors: Record<string, string> = {
  lead: 'bg-gray-100', estimate_scheduled: 'bg-blue-50', estimate_sent: 'bg-blue-100',
  negotiation: 'bg-purple-50', approved: 'bg-green-50', in_progress: 'bg-amber-50', on_hold: 'bg-orange-50',
};

function fmt(v: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(v);
}

export default function PipelinePage() {
  const navigate = useNavigate();

  const { data: pipeline, isLoading } = useApiGet<PipelineData>(['hardscape', 'pipeline'], '/v1/hardscape/pipeline');
  const stageMut = useApiMutation<unknown, { projectId: string; stage: string }>('put', (vars) => `/v1/hardscape/projects/${vars.projectId}/stage`, [['hardscape', 'pipeline'], ['hardscape-projects']]);

  const moveProject = (projectId: string, stage: string) => {
    stageMut.mutate({ projectId, stage }, {
      onSuccess: () => toast.success(`Moved to ${stage.replace(/_/g, ' ')}`),
      onError: () => toast.error('Failed to move project'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/hardscape')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title="Hardscape Pipeline" description="Kanban view of project stages" />
      </div>

      {isLoading ? <Skeleton className="h-96 w-full" /> : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: `${stageOrder.length * 280}px` }}>
            {stageOrder.map((stage) => {
              const data = pipeline?.[stage] ?? { count: 0, total_value: 0, projects: [] };
              return (
                <div key={stage} className={`w-[260px] flex-shrink-0 rounded-lg ${stageColors[stage] ?? 'bg-gray-50'} p-3`}>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold capitalize">{stage.replace(/_/g, ' ')}</h3>
                    <p className="text-xs text-muted-foreground">{data.count} projects - {fmt(data.total_value)}</p>
                  </div>
                  <div className="space-y-2">
                    {data.projects.map((p) => {
                      const currentIdx = stageOrder.indexOf(stage);
                      const nextStage = stageOrder[currentIdx + 1];
                      const prevStage = stageOrder[currentIdx - 1];
                      return (
                        <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/hardscape/projects/${p.id}`)}>
                          <CardContent className="p-3">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.customer_display_name}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-muted-foreground capitalize">{p.project_type.replace(/_/g, ' ')}</span>
                              {p.estimated_value && <span className="text-xs font-medium">{fmt(parseFloat(p.estimated_value))}</span>}
                            </div>
                            <div className="flex gap-1 mt-2">
                              {prevStage && <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); moveProject(p.id, prevStage); }} disabled={stageMut.isPending}>&larr;</Button>}
                              {nextStage && <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); moveProject(p.id, nextStage); }} disabled={stageMut.isPending}>&rarr;</Button>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
