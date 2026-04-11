import { CheckCircle, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Milestone {
  id: string; name: string; amount: string; status: string;
  invoice_id: string | null; completed_at: string | null; invoiced_at: string | null; paid_at: string | null;
}

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

interface MilestoneTimelineProps { milestones: Milestone[]; jobId: string; onRefresh: () => void; }

export function MilestoneTimeline({ milestones, onRefresh }: MilestoneTimelineProps) {
  const handleGenerate = async (msId: string, msName: string) => {
    try {
      const { apiClient } = await import('@/api/client');
      await apiClient.post(`/v1/billing/milestones/${msId}/generate-invoice`);
      toast.success(`Invoice generated for ${msName}`);
      onRefresh();
    } catch { toast.error('Failed to generate invoice.'); }
  };

  return (
    <div className="flex flex-wrap gap-3 items-center py-2">
      {milestones.map((ms, idx) => (
        <div key={ms.id} className="flex items-center gap-1">
          {idx > 0 && <span className="text-muted-foreground mx-1">·</span>}
          <span className="flex items-center gap-1.5">
            {ms.status === 'paid' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {ms.status === 'approved' && <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />}
            {ms.status === 'pending' && <Circle className="h-4 w-4 text-gray-300" />}
            <span className="text-sm">{ms.name} {fmt(ms.amount)}</span>
            <Badge variant="outline" className={cn('text-xs',
              ms.status === 'paid' && 'border-green-300 text-green-700',
              ms.status === 'approved' && 'border-blue-300 text-blue-700',
              ms.status === 'pending' && 'border-gray-300 text-gray-500',
            )}>
              {ms.status.toUpperCase()}
            </Badge>
          </span>
          {ms.status === 'pending' && (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleGenerate(ms.id, ms.name)}>
              Gen Invoice
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
