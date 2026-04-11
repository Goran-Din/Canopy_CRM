import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet } from '@/hooks/useApi';

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: string;
  due_date: string;
  paid_date: string | null;
}

interface Milestone {
  id: string;
  name: string;
  amount: string;
  status: string;
}

interface BillingTabProps {
  jobId: string;
}

function fmt(v: string | number | null): string {
  if (!v) return '$0.00';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

export function BillingTab({ jobId }: BillingTabProps) {
  const navigate = useNavigate();

  const { data: invoices = [] } = useApiGet<Invoice[]>(
    ['job-invoices', jobId],
    `/v1/jobs/${jobId}/invoices`,
  );

  const { data: milestones = [] } = useApiGet<Milestone[]>(
    ['job-milestones', jobId],
    `/v1/jobs/${jobId}/milestones`,
  );

  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices for this job.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Invoice #</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-left py-2 font-medium">Due Date</th>
                  <th className="text-left py-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="py-2">{inv.invoice_number}</td>
                    <td className="py-2"><StatusBadge status={inv.status} /></td>
                    <td className="text-right py-2 font-medium">{fmt(inv.total)}</td>
                    <td className="py-2">{new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="py-2">{inv.paid_date ? new Date(inv.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((ms) => (
                <div key={ms.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{ms.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(ms.amount)}</p>
                  </div>
                  <StatusBadge status={ms.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
