import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface OverdueInvoice {
  id: string; customer_name: string; customer_code: string;
  invoice_number: string; description: string; amount: string;
  days_overdue: number; is_escalated: boolean;
}

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function severityColor(days: number): string {
  if (days > 14) return 'text-red-600';
  if (days > 7) return 'text-orange-500';
  return 'text-amber-500';
}

function severityDot(days: number): string {
  if (days > 14) return '🔴';
  if (days > 7) return '🟠';
  return '🟡';
}

export function OverdueSection() {
  const navigate = useNavigate();
  const [escalateId, setEscalateId] = useState<string | null>(null);
  const [escalateNote, setEscalateNote] = useState('');

  const { data: invoices = [], refetch } = useApiGet<OverdueInvoice[]>(['billing-overdue'], '/v1/billing/overdue');

  const remindMut = useApiMutation<void, { invoice_id: string }>('post', '/v1/billing/remind', []);
  const escalateMut = useApiMutation<void, { note: string }>('patch', (vars) => `/v1/invoices/${escalateId}`, [['billing-overdue']]);

  const handleRemind = async (invoiceId: string) => {
    try {
      await remindMut.mutateAsync({ invoice_id: invoiceId });
      toast.success('Payment reminder sent');
    } catch { toast.error('Failed to send reminder.'); }
  };

  const handleEscalate = async () => {
    if (!escalateNote.trim()) { toast.error('Please add a note.'); return; }
    try {
      await escalateMut.mutateAsync({ note: escalateNote.trim() });
      toast.success('Invoice escalated — Erick will be notified');
      setEscalateId(null); setEscalateNote(''); refetch();
    } catch { toast.error('Failed to escalate.'); }
  };

  return (
    <div className="mt-4 space-y-4">
      {invoices.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} require follow-up</span>
        </div>
      )}

      <h3 className="font-semibold">Overdue ({invoices.length})</h3>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No overdue invoices.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Customer</th>
                <th className="text-left py-2 font-medium">Invoice</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium">Overdue</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      {inv.is_escalated && <Flag className="h-3.5 w-3.5 text-red-500" />}
                      <div>
                        <p className="font-medium">{inv.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{inv.customer_code} · {inv.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2">
                    <button className="text-primary hover:underline" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      {inv.invoice_number}
                    </button>
                  </td>
                  <td className="py-2 text-right font-medium">{fmt(inv.amount)}</td>
                  <td className="py-2">
                    <span className={cn('font-medium', severityColor(inv.days_overdue))}>
                      {severityDot(inv.days_overdue)} {inv.days_overdue} days overdue
                    </span>
                  </td>
                  <td className="py-2 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => handleRemind(inv.id)}>Remind</Button>
                    <Button size="sm" variant="outline" onClick={() => setEscalateId(inv.id)}>Escalate</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!escalateId} onOpenChange={(o) => !o && setEscalateId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Escalate Invoice</DialogTitle></DialogHeader>
          <Textarea value={escalateNote} onChange={(e) => setEscalateNote(e.target.value)} placeholder="Add escalation note..." className="min-h-[80px]" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEscalate}>Escalate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
