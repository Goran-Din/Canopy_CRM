import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';
import { InvoiceFormDialog } from './InvoiceFormDialog';

interface Invoice {
  id: string; invoice_number: string; status: string; customer_display_name: string;
  invoice_date: string; due_date: string; subtotal: string; tax_amount: string;
  total: string; amount_paid: string; xero_sync_status: string | null;
}

function fmt(v: string | null): string {
  if (!v) return '$0';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v));
}

const columns: Column<Invoice>[] = [
  { key: 'invoice_number', header: 'Invoice', render: (row) => <span className="font-medium">{row.invoice_number}</span> },
  { key: 'customer_display_name', header: 'Customer', render: (row) => <span className="text-sm">{row.customer_display_name}</span> },
  { key: 'invoice_date', header: 'Date', render: (row) => <span className="text-sm">{new Date(row.invoice_date).toLocaleDateString()}</span> },
  { key: 'due_date', header: 'Due', render: (row) => <span className="text-sm">{new Date(row.due_date).toLocaleDateString()}</span> },
  { key: 'total', header: 'Total', render: (row) => <span className="text-sm font-medium">{fmt(row.total)}</span> },
  { key: 'amount_paid', header: 'Paid', render: (row) => <span className="text-sm">{fmt(row.amount_paid)}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'xero_sync_status', header: 'Xero', render: (row) => row.xero_sync_status ? <StatusBadge status={row.xero_sync_status} /> : <span className="text-xs text-muted-foreground">-</span> },
];

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Invoice>(['invoices'], '/v1/invoices', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Billing and payment management" actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Invoice</Button>} />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search invoices..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partially_paid">Partially Paid</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No invoices found." onRowClick={(row) => navigate(`/invoices/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
      <InvoiceFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
