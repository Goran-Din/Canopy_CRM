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
import { ProspectFormDialog } from './ProspectFormDialog';

interface Prospect {
  id: string; first_name: string | null; last_name: string | null; company_name: string | null;
  email: string | null; phone: string | null; status: string; source: string | null;
  estimated_value: string | null; next_follow_up_date: string | null;
}

function fmt(v: string | null): string { if (!v) return '-'; return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(parseFloat(v)); }

const columns: Column<Prospect>[] = [
  { key: 'first_name', header: 'Name', render: (row) => <div><p className="font-medium">{[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}</p>{row.company_name && <p className="text-xs text-muted-foreground">{row.company_name}</p>}</div> },
  { key: 'email', header: 'Email', render: (row) => <span className="text-sm">{row.email ?? '-'}</span> },
  { key: 'source', header: 'Source', render: (row) => <span className="text-sm capitalize">{row.source?.replace(/_/g, ' ') ?? '-'}</span> },
  { key: 'estimated_value', header: 'Value', render: (row) => <span className="text-sm">{fmt(row.estimated_value)}</span> },
  { key: 'next_follow_up_date', header: 'Follow-up', render: (row) => <span className="text-sm">{row.next_follow_up_date ? new Date(row.next_follow_up_date).toLocaleDateString() : '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function ProspectListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (source !== 'all') params.source = source;

  const { data, isLoading } = useApiList<Prospect>(['prospects'], '/v1/prospects', params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        description="Manage sales prospects"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Prospect
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search prospects..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="new">New</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="qualified">Qualified</SelectItem><SelectItem value="proposal_sent">Proposal Sent</SelectItem><SelectItem value="won">Won</SelectItem><SelectItem value="lost">Lost</SelectItem></SelectContent></Select>
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Source" /></SelectTrigger><SelectContent><SelectItem value="all">All Sources</SelectItem><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="mautic">Mautic</SelectItem><SelectItem value="cold_call">Cold Call</SelectItem><SelectItem value="trade_show">Trade Show</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No prospects found." onRowClick={(row) => navigate(`/prospects/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
      <ProspectFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
