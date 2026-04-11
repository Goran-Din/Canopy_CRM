import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { InvoiceReviewPanel } from '../components/InvoiceReviewPanel';

interface Draft {
  id: string; customer_name: string; customer_code: string; property_address: string;
  package_name: string; period: string; amount: string; invoice_ref: string;
}

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export function DraftsSection() {
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);
  const [approving, setApproving] = useState(false);

  const { data: drafts = [], refetch } = useApiGet<Draft[]>(['billing-drafts'], '/v1/billing/drafts');

  const approveMut = useApiMutation<void, void>('post', '/v1/billing/drafts/placeholder/approve', [['billing-drafts'], ['billing-dashboard']]);

  const total = drafts.reduce((s, d) => s + parseFloat(d.amount || '0'), 0);

  const handleApproveAll = async () => {
    setApproving(true);
    let count = 0;
    for (const draft of drafts) {
      try {
        const { apiClient } = await import('@/api/client');
        await apiClient.post(`/v1/billing/drafts/${draft.id}/approve`);
        count++;
      } catch { /* continue */ }
    }
    toast.success(`${count} invoice${count !== 1 ? 's' : ''} approved`);
    setConfirmApproveAll(false);
    setApproving(false);
    refetch();
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Drafts to Review ({drafts.length})</h3>
        {drafts.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmApproveAll(true)}>Approve All</Button>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No drafts to review.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Customer</th>
                <th className="text-left py-2 font-medium">Property</th>
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2">
                    <p className="font-medium">{d.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{d.customer_code}</p>
                  </td>
                  <td className="py-2">{d.property_address}</td>
                  <td className="py-2">
                    <p>{d.package_name} {d.period}</p>
                    <p className="text-xs text-muted-foreground">{d.invoice_ref}</p>
                  </td>
                  <td className="py-2 text-right font-medium">{fmt(d.amount)}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setReviewId(d.id)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end pt-2 text-sm font-bold">Total: {fmt(total)}</div>
        </div>
      )}

      {reviewId && (
        <InvoiceReviewPanel draftId={reviewId} open={!!reviewId} onClose={() => setReviewId(null)} onApproved={() => { setReviewId(null); refetch(); }} />
      )}

      <ConfirmDialog open={confirmApproveAll} onOpenChange={setConfirmApproveAll} title="Approve All Drafts" description={`Approve and push ${drafts.length} invoices to Xero totalling ${fmt(total)}?`} onConfirm={handleApproveAll} />
    </div>
  );
}
