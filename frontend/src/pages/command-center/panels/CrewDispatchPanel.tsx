import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CrewPosition {
  crew_id: string;
  crew_name: string;
  status: string;
  current_property_address: string | null;
  last_gps_event_at: string | null;
  jobs_today: { job_id: string; status: string }[];
}

interface CrewDispatchPanelProps {
  crewPositions: CrewPosition[];
  summary?: { jobs_today_total: number; jobs_today_completed: number; jobs_today_active: number; jobs_today_scheduled: number; jobs_today_unassigned: number };
}

const STATUS_ORDER: Record<string, number> = { on_site: 0, in_transit: 1, no_signal: 2, not_clocked_in: 3, clocked_out: 4 };
const STATUS_DOTS: Record<string, string> = { on_site: '🟢', in_transit: '🔵', no_signal: '🟡', not_clocked_in: '⚪', clocked_out: '⚪' };
const STATUS_LABELS: Record<string, string> = { on_site: 'On site', in_transit: 'In transit', no_signal: 'No signal', not_clocked_in: 'NOT IN', clocked_out: 'Clocked out' };

export function CrewDispatchPanel({ crewPositions, summary }: CrewDispatchPanelProps) {
  const navigate = useNavigate();
  const sorted = [...crewPositions].sort((a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Crews & Dispatch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((crew) => {
          const doneCount = crew.jobs_today?.filter((j) => j.status === 'completed').length || 0;
          const totalJobs = crew.jobs_today?.length || 0;
          return (
            <button key={crew.crew_id} className="w-full text-left flex items-start gap-2 py-1.5 hover:bg-muted/50 rounded px-1" onClick={() => navigate('/live-map')}>
              <span className="text-sm">{STATUS_DOTS[crew.status] || '⚪'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{crew.crew_name}</span>
                  {crew.status === 'not_clocked_in' && <span className="text-xs">⚠️</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {crew.status === 'on_site' && crew.current_property_address ? `On site: ${crew.current_property_address}` : STATUS_LABELS[crew.status] || crew.status}
                  {crew.status === 'in_transit' && crew.last_gps_event_at && ` · ${new Date(crew.last_gps_event_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                </p>
                {totalJobs > 0 && <p className="text-xs text-muted-foreground">{totalJobs} jobs today · {doneCount} done</p>}
              </div>
            </button>
          );
        })}

        {sorted.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No crew data.</p>}

        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/live-map')}>
          View Full Map <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>

        {summary && (
          <>
            <div className="border-t pt-3">
              <p className="text-sm font-medium">Jobs Today — {summary.jobs_today_total} total</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                <span>Completed: {summary.jobs_today_completed}</span>
                <span>Active: {summary.jobs_today_active}</span>
                <span>Scheduled: {summary.jobs_today_scheduled}</span>
                <span className={cn(summary.jobs_today_unassigned > 0 && 'text-amber-600 font-medium')}>
                  Unassigned: {summary.jobs_today_unassigned}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/dispatch')}>
              Open Dispatch Board <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
