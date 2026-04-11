import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface DraftInvoice { id: string; customer_name: string; package_name: string; period: string; amount: string; }
interface OverdueInvoice { id: string; customer_name: string; days_overdue: number; amount: string; }

interface BillingQueuePanelProps { drafts: DraftInvoice[]; overdue: OverdueInvoice[]; }

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

export function BillingQueuePanel({ drafts, overdue }: BillingQueuePanelProps) {
  const navigate = useNavigate();
  const remindMut = useApiMutation<void, { invoice_id: string }>('post', '/v1/billing/remind', []);

  const handleRemind = async (inv: OverdueInvoice) => {
    try {
      await remindMut.mutateAsync({ invoice_id: inv.id });
      toast.success(`Payment reminder sent to ${inv.customer_name}`);
    } catch { toast.error('Failed to send reminder.'); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Billing Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drafts */}
        {drafts.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              {drafts.length} drafts to review
            </p>
            {drafts.slice(0, 5).map((d) => (
              <button key={d.id} className="w-full text-left flex items-center justify-between py-1 hover:bg-muted/50 rounded px-1 text-sm" onClick={() => navigate('/billing/drafts')}>
                <span className="truncate">{d.customer_name}</span>
                <span className="shrink-0 ml-2 font-medium">{fmt(d.amount)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" /> No drafts to review
          </p>
        )}

        <div className="border-t pt-3" />

        {/* Overdue */}
        {overdue.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-red-600 mb-2">{overdue.length} overdue invoices</p>
            {overdue.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-1 text-sm">
                <div className="truncate">
                  <span>{inv.customer_name}</span>
                  <span className="text-xs text-muted-foreground ml-1">{inv.days_overdue}d</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{fmt(inv.amount)}</span>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleRemind(inv)}>
                    Remind
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" /> No overdue invoices
          </p>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/billing')}>
          View all in Billing <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
