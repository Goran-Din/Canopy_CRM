import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Dispute {
  id: string; dispute_number: string; status: string; reason: string; description: string;
  priority: string; disputed_amount: string; customer_id: string; customer_display_name: string;
  invoice_id: string; invoice_number: string; assigned_to: string | null;
  resolution_notes: string | null; credit_amount: string | null; created_at: string;
}

function fmt(v: string | null): string {
  if (!v) return '-';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v));
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showResolve, setShowResolve] = useState(false);
  const [resolveData, setResolveData] = useState({ status: 'resolved_credit', resolution_notes: '', credit_amount: '', credit_reason: '' });

  const { data: dispute, isLoading } = useApiGet<Dispute>(['dispute', id], `/v1/disputes/${id}`, undefined, { enabled: !!id });
  const resolveMut = useApiMutation('put', `/v1/disputes/${id}/resolve`, [['disputes'], ['dispute', id]]);
  const creditMut = useApiMutation('post', '/v1/credit-notes', [['disputes'], ['dispute', id]]);

  const handleResolve = () => {
    const payload: Record<string, unknown> = { status: resolveData.status, resolution_notes: resolveData.resolution_notes };
    if (resolveData.status === 'resolved_credit' && resolveData.credit_amount) {
      payload.credit_amount = parseFloat(resolveData.credit_amount);
      payload.credit_reason = resolveData.credit_reason;
    }
    resolveMut.mutate(payload as never, {
      onSuccess: () => {
        toast.success('Dispute resolved');
        setShowResolve(false);
        if (resolveData.status === 'resolved_credit' && resolveData.credit_amount && dispute) {
          creditMut.mutate({ invoice_id: dispute.invoice_id, customer_id: dispute.customer_id, amount: parseFloat(resolveData.credit_amount), reason: resolveData.credit_reason || resolveData.resolution_notes, dispute_id: id } as never, {
            onSuccess: () => toast.success('Credit note created'),
            onError: () => toast.error('Credit note creation failed'),
          });
        }
      },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!dispute) return <div className="text-center py-12"><p className="text-muted-foreground">Dispute not found</p><Button variant="link" onClick={() => navigate('/disputes')}>Back</Button></div>;

  const isOpen = ['open', 'under_review'].includes(dispute.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/disputes')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={dispute.dispute_number} description={dispute.customer_display_name} actions={isOpen ? <Button onClick={() => setShowResolve(true)}>Resolve Dispute</Button> : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={dispute.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Customer</p><Link to={`/customers/${dispute.customer_id}`} className="text-primary hover:underline">{dispute.customer_display_name}</Link></div>
            <div><p className="text-xs text-muted-foreground">Invoice</p><Link to={`/invoices/${dispute.invoice_id}`} className="text-primary hover:underline">{dispute.invoice_number}</Link></div>
            <div><p className="text-xs text-muted-foreground">Reason</p><p className="capitalize">{dispute.reason.replace(/_/g, ' ')}</p></div>
            <div><p className="text-xs text-muted-foreground">Disputed Amount</p><p className="font-medium">{fmt(dispute.disputed_amount)}</p></div>
            <div><p className="text-xs text-muted-foreground">Priority</p><StatusBadge status={dispute.priority} /></div>
            <div><p className="text-xs text-muted-foreground">Created</p><p>{new Date(dispute.created_at).toLocaleDateString()}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Description & Resolution</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><p className="text-xs text-muted-foreground mb-1">Description</p><p className="whitespace-pre-wrap">{dispute.description}</p></div>
            {dispute.resolution_notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Resolution Notes</p><p className="whitespace-pre-wrap">{dispute.resolution_notes}</p></div>}
            {dispute.credit_amount && <div><p className="text-xs text-muted-foreground">Credit Amount</p><p className="font-medium text-green-600">{fmt(dispute.credit_amount)}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResolve} onOpenChange={setShowResolve}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Resolve Dispute</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormField label="Resolution">
              <Select value={resolveData.status} onValueChange={(v) => setResolveData({ ...resolveData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="resolved_credit">Issue Credit</SelectItem><SelectItem value="resolved_adjusted">Adjust Invoice</SelectItem><SelectItem value="resolved_no_action">No Action Needed</SelectItem></SelectContent>
              </Select>
            </FormField>
            <FormField label="Resolution Notes" required><textarea value={resolveData.resolution_notes} onChange={(e) => setResolveData({ ...resolveData, resolution_notes: e.target.value })} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></FormField>
            {resolveData.status === 'resolved_credit' && (
              <>
                <FormField label="Credit Amount"><Input type="number" step="0.01" value={resolveData.credit_amount} onChange={(e) => setResolveData({ ...resolveData, credit_amount: e.target.value })} /></FormField>
                <FormField label="Credit Reason"><Input value={resolveData.credit_reason} onChange={(e) => setResolveData({ ...resolveData, credit_reason: e.target.value })} /></FormField>
              </>
            )}
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button><Button onClick={handleResolve} disabled={resolveMut.isPending}>{resolveMut.isPending ? 'Resolving...' : 'Resolve'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
