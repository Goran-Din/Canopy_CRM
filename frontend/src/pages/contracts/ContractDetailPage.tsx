import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ContractFormDialog } from './ContractFormDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface LineItem { id: string; service_name: string; description: string | null; quantity: number; unit_price: string; sort_order: number }
interface Contract {
  id: string; contract_number: string; title: string; status: string; contract_type: string; division: string;
  customer_id: string; customer_display_name: string; property_id: string; property_name: string | null;
  description: string | null; start_date: string; end_date: string | null; billing_frequency: string;
  contract_value: string | null; recurring_amount: string | null; auto_renew: boolean; notes: string | null;
  line_items: LineItem[]; created_at: string; updated_at: string;
}

function fmt(v: string | number | null): string {
  if (!v) return '-';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(typeof v === 'string' ? parseFloat(v) : v);
}

const statusTransitions: Record<string, string[]> = {
  draft: ['pending_approval', 'active', 'cancelled'],
  pending_approval: ['active', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);

  const { data: contract, isLoading } = useApiGet<Contract>(['contract', id], `/v1/contracts/${id}`, undefined, { enabled: !!id });
  const statusMut = useApiMutation('put', `/v1/contracts/${id}/status`, [['contracts'], ['contract', id]]);

  const changeStatus = (newStatus: string) => {
    statusMut.mutate({ status: newStatus } as never, {
      onSuccess: () => toast.success(`Status changed to ${newStatus.replace(/_/g, ' ')}`),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!contract) return <div className="text-center py-12"><p className="text-muted-foreground">Contract not found</p><Button variant="link" onClick={() => navigate('/contracts')}>Back to Contracts</Button></div>;

  const nextStatuses = statusTransitions[contract.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={contract.title} description={contract.contract_number} actions={<Button variant="outline" onClick={() => setShowEdit(true)}><Edit className="mr-2 h-4 w-4" />Edit</Button>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={contract.status} /></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3"><FileText className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Customer</p><Link to={`/customers/${contract.customer_id}`} className="text-sm text-primary hover:underline">{contract.customer_display_name}</Link></div></div>
            {contract.property_name && <div className="flex items-start gap-3"><FileText className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Property</p><Link to={`/properties/${contract.property_id}`} className="text-sm text-primary hover:underline">{contract.property_name}</Link></div></div>}
            <div className="flex items-start gap-3"><FileText className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Type / Division</p><p className="text-sm capitalize">{contract.contract_type.replace(/_/g, ' ')} / {contract.division.replace(/_/g, ' ')}</p></div></div>
            <div className="flex items-start gap-3"><Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Period</p><p className="text-sm">{new Date(contract.start_date).toLocaleDateString()} - {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : 'Ongoing'}</p></div></div>
            <div className="flex items-start gap-3"><DollarSign className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Value</p><p className="text-sm">{fmt(contract.contract_value)}</p></div></div>
            <div><p className="text-xs text-muted-foreground">Billing</p><p className="text-sm capitalize">{contract.billing_frequency.replace(/_/g, ' ')}{contract.auto_renew ? ' (auto-renew)' : ''}</p></div>
            {contract.notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm whitespace-pre-wrap">{contract.notes}</p></div>}

            {nextStatuses.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs text-muted-foreground">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((s) => (
                    <Button key={s} size="sm" variant={s === 'cancelled' ? 'destructive' : 'outline'} onClick={() => changeStatus(s)} disabled={statusMut.isPending}>
                      {s.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
          <CardContent>
            {contract.line_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Service</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contract.line_items.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell><p className="font-medium">{li.service_name}</p>{li.description && <p className="text-xs text-muted-foreground">{li.description}</p>}</TableCell>
                      <TableCell className="text-right">{li.quantity}</TableCell>
                      <TableCell className="text-right">{fmt(li.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(li.quantity * parseFloat(li.unit_price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ContractFormDialog open={showEdit} onOpenChange={setShowEdit} contract={contract as never} />
    </div>
  );
}
