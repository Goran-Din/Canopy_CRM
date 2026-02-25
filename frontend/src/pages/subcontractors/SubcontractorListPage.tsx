import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Subcontractor {
  id: string; company_name: string; contact_name: string | null; email: string | null;
  phone: string | null; status: string; specialty: string[]; rating: number | null;
  rate_type: string | null; default_rate: string | null;
}

const columns: Column<Subcontractor>[] = [
  { key: 'company_name', header: 'Company', render: (row) => <div><p className="font-medium">{row.company_name}</p>{row.contact_name && <p className="text-xs text-muted-foreground">{row.contact_name}</p>}</div> },
  { key: 'email', header: 'Email', render: (row) => <span className="text-sm">{row.email ?? '-'}</span> },
  { key: 'phone', header: 'Phone', render: (row) => <span className="text-sm">{row.phone ?? '-'}</span> },
  { key: 'specialty', header: 'Specialty', render: (row) => <div className="flex flex-wrap gap-1">{(row.specialty ?? []).slice(0, 3).map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{s}</span>)}</div> },
  { key: 'rating', header: 'Rating', render: (row) => <span className="text-sm">{row.rating ? `${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}` : '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function SubcontractorListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Subcontractor>(['subcontractors'], '/v1/subcontractors', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Subcontractors" description="Manage subcontractor partnerships" />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search subcontractors..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blacklisted">Blacklisted</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No subcontractors found." pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
