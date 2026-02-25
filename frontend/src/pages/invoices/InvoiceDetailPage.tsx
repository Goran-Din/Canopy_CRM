import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { InvoiceFormDialog } from './InvoiceFormDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface LineItem { id: string; description: string; quantity: number; unit_price: string; tax_rate: string; line_total: string }
interface Payment { id: string; payment_date: string; amount: string; payment_method: string; reference_number: string | null; notes: string | null }
interface Invoice {
  id: string; invoice_number: string; status: string; customer_id: string; customer_display_name: string;
  property_id: string | null; invoice_date: string; due_date: string; subtotal: string; tax_amount: string;
  total: string; amount_paid: string; balance_due: string; tax_rate: string; discount_amount: string;
  division: string | null; notes: string | null; xero_sync_status: string | null; xero_invoice_id: string | null;
  line_items: LineItem[]; payments: Payment[]; created_at: string;
}

function fmt(v: string | number | null): string {
  if (!v) return '$0.00';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(typeof v === 'string' ? parseFloat(v) : v);
}

const paymentColumns: Column<Payment>[] = [
  { key: 'payment_date', header: 'Date', render: (row) => <span className="text-sm">{new Date(row.payment_date).toLocaleDateString()}</span> },
  { key: 'amount', header: 'Amount', render: (row) => <span className="text-sm font-medium">{fmt(row.amount)}</span> },
  { key: 'payment_method', header: 'Method', render: (row) => <span className="text-sm capitalize">{row.payment_method.replace(/_/g, ' ')}</span> },
  { key: 'reference_number', header: 'Reference', render: (row) => <span className="text-sm">{row.reference_number ?? '-'}</span> },
];

const statusTransitions: Record<string, string[]> = {
  draft: ['pending', 'sent', 'cancelled'],
  pending: ['sent', 'cancelled'],
  sent: ['paid', 'cancelled'],
  viewed: ['paid', 'cancelled'],
  partially_paid: ['paid'],
  overdue: ['paid', 'cancelled'],
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({ payment_date: new Date().toISOString().split('T')[0], amount: '', payment_method: 'bank_transfer', reference_number: '', notes: '' });

  const { data: invoice, isLoading } = useApiGet<Invoice>(['invoice', id], `/v1/invoices/${id}`, undefined, { enabled: !!id });
  const statusMut = useApiMutation('put', `/v1/invoices/${id}/status`, [['invoices'], ['invoice', id]]);
  const paymentMut = useApiMutation('post', `/v1/invoices/${id}/payments`, [['invoices'], ['invoice', id]]);
  const xeroMut = useApiMutation('post', `/v1/integrations/xero/sync-invoice/${id}`, [['invoice', id]]);

  const changeStatus = (s: string) => {
    statusMut.mutate({ status: s } as never, { onSuccess: () => toast.success(`Status: ${s}`), onError: (err) => toast.error(err.response?.data?.message ?? 'Failed') });
  };

  const recordPayment = () => {
    paymentMut.mutate({ ...paymentData, amount: parseFloat(paymentData.amount), reference_number: paymentData.reference_number || null, notes: paymentData.notes || null } as never, {
      onSuccess: () => { toast.success('Payment recorded'); setShowPayment(false); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const syncXero = () => {
    xeroMut.mutate({} as never, { onSuccess: () => toast.success('Synced to Xero'), onError: () => toast.error('Xero sync failed') });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!invoice) return <div className="text-center py-12"><p className="text-muted-foreground">Invoice not found</p><Button variant="link" onClick={() => navigate('/invoices')}>Back</Button></div>;

  const nextStatuses = statusTransitions[invoice.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={invoice.invoice_number} description={invoice.customer_display_name} actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={syncXero} disabled={xeroMut.isPending}><RefreshCw className="mr-1 h-4 w-4" />Sync Xero</Button>
            <Button variant="outline" size="sm" onClick={() => setShowPayment(true)}><DollarSign className="mr-1 h-4 w-4" />Record Payment</Button>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}><Edit className="mr-1 h-4 w-4" />Edit</Button>
          </div>
        } />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={invoice.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Customer</p><Link to={`/customers/${invoice.customer_id}`} className="text-primary hover:underline">{invoice.customer_display_name}</Link></div>
            <div><p className="text-xs text-muted-foreground">Date</p><p>{new Date(invoice.invoice_date).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Due</p><p>{new Date(invoice.due_date).toLocaleDateString()}</p></div>
            <div className="pt-2 border-t space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(invoice.tax_amount)}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>{fmt(invoice.total)}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(invoice.amount_paid)}</span></div>
              <div className="flex justify-between font-bold text-amber-600"><span>Balance</span><span>{fmt(invoice.balance_due)}</span></div>
            </div>
            {invoice.xero_sync_status && <div><p className="text-xs text-muted-foreground">Xero Status</p><StatusBadge status={invoice.xero_sync_status} /></div>}
            {nextStatuses.length > 0 && (
              <div className="pt-2 border-t space-y-2"><p className="text-xs text-muted-foreground">Change Status</p><div className="flex flex-wrap gap-2">{nextStatuses.map((s) => <Button key={s} size="sm" variant={s === 'cancelled' ? 'destructive' : 'outline'} onClick={() => changeStatus(s)} disabled={statusMut.isPending}>{s.replace(/_/g, ' ')}</Button>)}</div></div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>{invoice.line_items.map((li) => (
                  <TableRow key={li.id}><TableCell>{li.description}</TableCell><TableCell className="text-right">{li.quantity}</TableCell><TableCell className="text-right">{fmt(li.unit_price)}</TableCell><TableCell className="text-right font-medium">{fmt(li.line_total)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Payments ({invoice.payments?.length ?? 0})</CardTitle></CardHeader>
            <CardContent><DataTable columns={paymentColumns} data={invoice.payments ?? []} emptyMessage="No payments recorded." /></CardContent>
          </Card>
        </div>
      </div>

      <InvoiceFormDialog open={showEdit} onOpenChange={setShowEdit} invoice={invoice as never} />

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormField label="Date"><Input type="date" value={paymentData.payment_date} onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })} /></FormField>
            <FormField label="Amount"><Input type="number" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} /></FormField>
            <FormField label="Method">
              <Select value={paymentData.payment_method} onValueChange={(v) => setPaymentData({ ...paymentData, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="check">Check</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
              </Select>
            </FormField>
            <FormField label="Reference"><Input value={paymentData.reference_number} onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })} /></FormField>
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button><Button onClick={recordPayment} disabled={paymentMut.isPending}>{paymentMut.isPending ? 'Recording...' : 'Record Payment'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
