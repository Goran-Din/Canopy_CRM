import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronUp, ChevronDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Stop { id: string; property_id: string; property_name: string | null; address_line1: string | null; stop_order: number; estimated_arrival_time: string | null; estimated_duration_minutes: number | null; notes: string | null }
interface RouteDetail {
  id: string; route_name: string; division: string; day_of_week: string; status: string;
  crew_id: string | null; crew_name: string | null; zone: string | null;
  estimated_duration_hours: number | null; notes: string | null; stops: Stop[];
}

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: route, isLoading } = useApiGet<RouteDetail>(['route', id], `/v1/routes/${id}`, undefined, { enabled: !!id });
  const reorderMut = useApiMutation('put', `/v1/routes/${id}/stops/reorder`, [['route', id]]);

  const moveStop = (idx: number, direction: 'up' | 'down') => {
    if (!route) return;
    const stops = [...route.stops].sort((a, b) => a.stop_order - b.stop_order);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= stops.length) return;
    [stops[idx], stops[newIdx]] = [stops[newIdx], stops[idx]];
    const stopIds = stops.map((s) => s.id);
    reorderMut.mutate({ stop_ids: stopIds } as never, {
      onSuccess: () => toast.success('Route reordered'),
      onError: () => toast.error('Failed to reorder'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!route) return <div className="text-center py-12"><p className="text-muted-foreground">Route not found</p><Button variant="link" onClick={() => navigate('/routes')}>Back</Button></div>;

  const sortedStops = [...(route.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/routes')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={route.route_name} description={`${route.day_of_week} - ${route.division.replace(/_/g, ' ')}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={route.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Day</p><p className="capitalize">{route.day_of_week}</p></div>
            <div><p className="text-xs text-muted-foreground">Division</p><p className="capitalize">{route.division.replace(/_/g, ' ')}</p></div>
            <div><p className="text-xs text-muted-foreground">Crew</p><p>{route.crew_name ?? 'Unassigned'}</p></div>
            {route.zone && <div><p className="text-xs text-muted-foreground">Zone</p><p>{route.zone}</p></div>}
            {route.estimated_duration_hours && <div><p className="text-xs text-muted-foreground">Est. Duration</p><p>{route.estimated_duration_hours}h</p></div>}
            {route.notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="whitespace-pre-wrap">{route.notes}</p></div>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Stops ({sortedStops.length})</CardTitle></CardHeader>
          <CardContent>
            {sortedStops.length === 0 ? <p className="text-sm text-muted-foreground">No stops.</p> : (
              <div className="space-y-2">
                {sortedStops.map((stop, idx) => (
                  <div key={stop.id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveStop(idx, 'up')} disabled={idx === 0 || reorderMut.isPending}><ChevronUp className="h-3 w-3" /></Button>
                      <span className="text-center text-xs font-bold text-muted-foreground">{idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveStop(idx, 'down')} disabled={idx === sortedStops.length - 1 || reorderMut.isPending}><ChevronDown className="h-3 w-3" /></Button>
                    </div>
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/properties/${stop.property_id}`} className="text-sm font-medium text-primary hover:underline">{stop.property_name ?? stop.address_line1 ?? 'Unknown'}</Link>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {stop.estimated_arrival_time && <span>Arrive: {stop.estimated_arrival_time}</span>}
                        {stop.estimated_duration_minutes && <span>{stop.estimated_duration_minutes} min</span>}
                      </div>
                      {stop.notes && <p className="text-xs text-muted-foreground mt-1">{stop.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
