import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useApiGet } from '@/hooks/useApi';
import { MilestoneTimeline } from '../components/MilestoneTimeline';

interface HardscapeProject {
  id: string; job_id: string; job_number: string; customer_name: string; description: string;
  total: number; collected: number; outstanding: number;
  milestones: { id: string; name: string; amount: string; status: string; invoice_id: string | null; completed_at: string | null; invoiced_at: string | null; paid_at: string | null; }[];
}

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
}

export function HardscapeSection() {
  const navigate = useNavigate();
  const { data: projects = [], refetch } = useApiGet<HardscapeProject[]>(['billing-hardscape'], '/v1/billing/hardscape');

  return (
    <div className="mt-4 space-y-4">
      <h3 className="font-semibold">Hardscape Projects ({projects.length})</h3>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No active hardscape projects.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((proj) => (
            <Card key={proj.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{proj.customer_name} — {proj.description}</p>
                    <button className="text-xs text-primary hover:underline" onClick={() => navigate(`/jobs/${proj.job_id}`)}>
                      Job #{proj.job_number}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: {fmt(proj.total)} · Collected: {fmt(proj.collected)} ({Math.round((proj.collected / proj.total) * 100)}%) · Outstanding: {fmt(proj.outstanding)}
                </p>
                <MilestoneTimeline milestones={proj.milestones} jobId={proj.job_id} onRefresh={refetch} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
