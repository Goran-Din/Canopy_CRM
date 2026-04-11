import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ServiceProgress {
  service_name: string;
  completed: number;
  total: number;
  pending: number;
}

interface SeasonSummary {
  completion_pct: number;
  services: ServiceProgress[];
}

interface SeasonProgressPanelProps {
  seasonData: SeasonSummary | null;
}

export function SeasonProgressPanel({ seasonData }: SeasonProgressPanelProps) {
  const navigate = useNavigate();

  const services = (seasonData?.services || [])
    .filter((s) => s.pending > 0)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Season Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {services.length > 0 ? (
          services.map((s) => (
            <div key={s.service_name} className="flex items-center justify-between text-sm">
              <span>{s.service_name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{s.completed}/{s.total}</span>
                <span>{s.pending} pending</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" /> All services on schedule
          </p>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/reports')}>
          View Full Season Report <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
