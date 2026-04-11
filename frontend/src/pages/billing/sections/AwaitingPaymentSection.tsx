import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface AwaitingInvoice {
  id: string; customer_name: string; customer_code: string;
  invoice_number: string; amount: string; due_date: string; days_until_due: number;
}

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export function AwaitingPaymentSection() {
  const navigate = useNavigate();
  const { data: invoices = [] } = useApiGet<AwaitingInvoice[]>(['billing-awaiting'], '/v1/invoices', { status: 'sent,viewed' });

  const remindMut = useApiMutation<void, { invoice_id: string }>('post', '/v1/billing/remind', []);

  const handleRemind = async (invoiceId: string) => {
    try {
      await remindMut.mutateAsync({ invoice_id: invoiceId });
      toast.success('Payment reminder sent');
    } catch { toast.error('Failed to send reminder.'); }
  };

  return (
    <div className="mt-4 space-y-4">
      <h3 className="font-semibold">Awaiting Payment ({invoices.length})</h3>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No invoices awaiting payment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Customer</th>
                <th className="text-left py-2 font-medium">Invoice</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium">Due Date</th>
                <th className="text-right py-2 font-medium">Days</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2">
                    <p className="font-medium">{inv.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.customer_code}</p>
                  </td>
                  <td className="py-2">
                    <button className="text-primary hover:underline" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      {inv.invoice_number}
                    </button>
                  </td>
                  <td className="py-2 text-right font-medium">{fmt(inv.amount)}</td>
                  <td className="py-2">{new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className="py-2 text-right">{inv.days_until_due}d</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => handleRemind(inv.id)}>Remind</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
