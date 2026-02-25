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
import { ContractFormDialog } from './ContractFormDialog';

interface Contract {
  id: string; contract_number: string; title: string; status: string; contract_type: string;
  division: string; customer_display_name: string; contract_value: string | null;
  start_date: string; end_date: string | null; created_at: string;
}

function fmt(amount: string | number | null): string {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
}

const columns: Column<Contract>[] = [
  { key: 'title', header: 'Contract', render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.contract_number}</p></div> },
  { key: 'customer_display_name', header: 'Customer', render: (row) => <span className="text-sm">{row.customer_display_name}</span> },
  { key: 'contract_type', header: 'Type', render: (row) => <span className="text-sm capitalize">{row.contract_type.replace(/_/g, ' ')}</span> },
  { key: 'division', header: 'Division', render: (row) => <span className="text-sm capitalize">{row.division.replace(/_/g, ' ')}</span> },
  { key: 'contract_value', header: 'Value', render: (row) => <span className="text-sm">{fmt(row.contract_value)}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'start_date', header: 'Start', render: (row) => <span className="text-sm">{new Date(row.start_date).toLocaleDateString()}</span> },
];

export default function ContractListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [division, setDivision] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (division !== 'all') params.division = division;

  const { data, isLoading } = useApiList<Contract>(['contracts'], '/v1/contracts', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Contracts" description="Manage service contracts" actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Contract</Button>} />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search contracts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_approval">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={division} onValueChange={(v) => { setDivision(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Division" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            <SelectItem value="landscaping_maintenance">Maintenance</SelectItem>
            <SelectItem value="landscaping_projects">Projects</SelectItem>
            <SelectItem value="hardscape">Hardscape</SelectItem>
            <SelectItem value="snow_removal">Snow</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No contracts found." onRowClick={(row) => navigate(`/contracts/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
      <ContractFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
