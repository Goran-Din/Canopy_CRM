import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, CheckCircle, MapPin, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CrewPosition } from '../LiveCrewMapPage';

interface CrewRowDetailProps {
  crew: CrewPosition;
  onClick: () => void;
}

function formatTimeOnSite(arrivedAt: string | null): string {
  if (!arrivedAt) return '';
  const diff = Date.now() - new Date(arrivedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; className: string }> = {
  on_site: { dot: '🟢', label: 'ON SITE', className: 'text-green-700' },
  in_transit: { dot: '🔵', label: 'IN TRANSIT', className: 'text-blue-700' },
  not_clocked_in: { dot: '⚪', label: 'NOT CLOCKED IN', className: 'text-gray-500' },
  clocked_out: { dot: '⚪', label: 'CLOCKED OUT', className: 'text-gray-400' },
  no_signal: { dot: '🟡', label: 'NO SIGNAL', className: 'text-amber-600' },
};

export function CrewRowDetail({ crew, onClick }: CrewRowDetailProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const config = STATUS_CONFIG[crew.status] || STATUS_CONFIG.not_clocked_in;

  return (
    <div className={cn('border-b last:border-0', crew.status === 'clocked_out' && 'opacity-50')}>
      {/* Collapsed row */}
      <button
        className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
        onClick={() => { setExpanded(!expanded); onClick(); }}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="text-sm">{config.dot}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{crew.crew_name}</span>
          <span className={cn('text-xs ml-2', config.className)}>
            {config.label}
            {crew.status === 'on_site' && crew.current_property_address && `: ${crew.current_property_address}`}
          </span>
          {crew.status === 'not_clocked_in' && <span className="ml-1">⚠️</span>}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pl-10 space-y-2">
          {crew.status === 'on_site' && crew.arrived_at && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {crew.current_job_number && <p>Job #{crew.current_job_number}</p>}
              <p>Arrived: {new Date(crew.arrived_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} &middot; Time on site: {formatTimeOnSite(crew.arrived_at)}</p>
            </div>
          )}

          {crew.status === 'in_transit' && crew.last_gps_event_at && (
            <p className="text-xs text-muted-foreground">
              Last seen: {new Date(crew.last_gps_event_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}

          {/* Today's schedule */}
          {crew.jobs_today && crew.jobs_today.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Today's Schedule:</p>
              {crew.jobs_today.map((job) => (
                <div key={job.job_id} className="flex items-center gap-1.5 text-xs">
                  {job.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                  {job.status === 'in_progress' && <MapPin className="h-3 w-3 text-primary" />}
                  {!['completed', 'in_progress'].includes(job.status) && <Circle className="h-3 w-3 text-gray-300" />}
                  <span className={cn(job.status === 'completed' && 'text-muted-foreground line-through')}>
                    {job.property_address}
                  </span>
                  {job.duration_minutes && job.status === 'completed' && (
                    <span className="text-muted-foreground">({job.duration_minutes} min)</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => navigate('/dispatch')}>
              View Jobs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
