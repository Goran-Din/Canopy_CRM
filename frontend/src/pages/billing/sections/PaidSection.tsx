import { useNavigate } from 'react-router-dom';
import { useApiGet } from '@/hooks/useApi';

interface PaidInvoice {
  id: string; customer_name: string; invoice_number: string; amount: string; paid_date: string;
}

function fmt(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export function PaidSection() {
  const navigate = useNavigate();
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const { data: invoices = [] } = useApiGet<PaidInvoice[]>(['billing-paid'], '/v1/invoices', { status: 'paid', paid_after: firstOfMonth });

  return (
    <div className="mt-4 space-y-4">
      <h3 className="font-semibold">Paid This Month ({invoices.length})</h3>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No invoices paid this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Customer</th>
                <th className="text-left py-2 font-medium">Invoice</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td className="py-2 font-medium">{inv.customer_name}</td>
                  <td className="py-2 text-primary">{inv.invoice_number}</td>
                  <td className="py-2 text-right font-medium">{fmt(inv.amount)}</td>
                  <td className="py-2">{new Date(inv.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
