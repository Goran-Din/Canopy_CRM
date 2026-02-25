import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Dispute {
  id: string; dispute_number: string; status: string; reason: string; priority: string;
  disputed_amount: string; customer_display_name: string; invoice_number: string; created_at: string;
}

function fmt(v: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v));
}

const columns: Column<Dispute>[] = [
  { key: 'dispute_number', header: 'Dispute', render: (row) => <span className="font-medium">{row.dispute_number}</span> },
  { key: 'customer_display_name', header: 'Customer', render: (row) => <span className="text-sm">{row.customer_display_name}</span> },
  { key: 'invoice_number', header: 'Invoice', render: (row) => <span className="text-sm">{row.invoice_number}</span> },
  { key: 'reason', header: 'Reason', render: (row) => <span className="text-sm capitalize">{row.reason.replace(/_/g, ' ')}</span> },
  { key: 'disputed_amount', header: 'Amount', render: (row) => <span className="text-sm font-medium">{fmt(row.disputed_amount)}</span> },
  { key: 'priority', header: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function DisputeListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (priority !== 'all') params.priority = priority;

  const { data, isLoading } = useApiList<Dispute>(['disputes'], '/v1/disputes', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Disputes" description="Manage billing disputes" />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search disputes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="under_review">Under Review</SelectItem><SelectItem value="resolved_credit">Resolved (Credit)</SelectItem><SelectItem value="resolved_adjusted">Resolved (Adjusted)</SelectItem><SelectItem value="resolved_no_action">Resolved (No Action)</SelectItem></SelectContent></Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger><SelectContent><SelectItem value="all">All Priority</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No disputes found." onRowClick={(row) => navigate(`/disputes/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
