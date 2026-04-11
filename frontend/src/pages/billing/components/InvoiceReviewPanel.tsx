import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface DraftLine { id: string; description: string; unit_price: number; quantity: number; line_total: number; }
interface DraftDetail {
  id: string; customer_name: string; customer_code: string; period_start: string; period_end: string;
  due_date: string; total: string; xero_account_code: string; reference: string;
  line_items: DraftLine[];
}

function fmt(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

interface InvoiceReviewPanelProps {
  draftId: string; open: boolean; onClose: () => void; onApproved: () => void;
}

export function InvoiceReviewPanel({ draftId, open, onClose, onApproved }: InvoiceReviewPanelProps) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editedItems, setEditedItems] = useState<DraftLine[]>([]);

  const { data: draft } = useApiGet<DraftDetail>(['billing-draft', draftId], `/v1/billing/drafts/${draftId}`, undefined, { enabled: open });

  const approveMut = useApiMutation<void, void>('post', `/v1/billing/drafts/${draftId}/approve`, [['billing-drafts'], ['billing-dashboard']]);
  const rejectMut = useApiMutation<void, { reason: string }>('post', `/v1/billing/drafts/${draftId}/reject`, [['billing-drafts'], ['billing-dashboard']]);
  const patchMut = useApiMutation<void, { line_items: DraftLine[] }>('patch', `/v1/billing/drafts/${draftId}`, [['billing-draft', draftId]]);

  const handleApprove = async () => {
    try {
      await approveMut.mutateAsync(undefined as never);
      toast.success('Invoice approved and pushed to Xero');
      onApproved();
    } catch { toast.error('Failed to approve.'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please provide a reason.'); return; }
    try {
      await rejectMut.mutateAsync({ reason: rejectReason.trim() });
      toast.success('Invoice rejected');
      setRejecting(false); setRejectReason(''); onClose();
    } catch { toast.error('Failed to reject.'); }
  };

  const handleSaveEdit = async () => {
    try {
      await patchMut.mutateAsync({ line_items: editedItems });
      toast.success('Draft updated');
      setEditing(false);
    } catch { toast.error('Failed to save.'); }
  };

  const startEdit = () => {
    if (draft) { setEditedItems(draft.line_items.map((li) => ({ ...li }))); setEditing(true); }
  };

  const items = editing ? editedItems : (draft?.line_items || []);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Invoice — {draft?.customer_name} {draft?.customer_code && `(${draft.customer_code})`}</DialogTitle>
        </DialogHeader>

        {draft && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Period:</span> {draft.period_start} – {draft.period_end}</p>
              <p><span className="text-muted-foreground">Due:</span> {draft.due_date}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">Line Items</Label>
              {items.map((li, idx) => (
                <div key={li.id} className="flex items-center justify-between py-1 border-b last:border-0 text-sm">
                  {editing ? (
                    <>
                      <Input value={li.description} onChange={(e) => { const next = [...editedItems]; next[idx] = { ...next[idx], description: e.target.value }; setEditedItems(next); }} className="h-7 text-sm flex-1 mr-2" />
                      <Input type="number" value={li.unit_price} onChange={(e) => { const next = [...editedItems]; next[idx] = { ...next[idx], unit_price: parseFloat(e.target.value) || 0 }; setEditedItems(next); }} className="h-7 text-sm w-24 text-right" />
                    </>
                  ) : (
                    <>
                      <span>{li.description}</span>
                      <span className="font-medium">{fmt(li.line_total)}</span>
                    </>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2 font-bold text-sm">
                <span>Total</span><span>{fmt(draft.total)}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Xero account: {draft.xero_account_code}</p>
              <p>Reference: {draft.reference}</p>
            </div>

            {rejecting && (
              <div className="space-y-2">
                <Label>Rejection reason</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this draft being rejected?" className="min-h-[60px]" autoFocus />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject}>Reject</Button>
            </>
          ) : editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </>
          ) : (
            <>
              <Button variant="destructive" size="sm" onClick={() => setRejecting(true)}>Reject</Button>
              <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
              <Button className="bg-[#2E7D32] hover:bg-[#256429]" onClick={handleApprove}>Approve & Push to Xero</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
