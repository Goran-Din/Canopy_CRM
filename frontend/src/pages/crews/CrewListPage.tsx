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
import { CrewFormDialog } from './CrewFormDialog';

interface Crew {
  id: string; crew_name: string; division: string; status: string;
  crew_leader_name: string | null; member_count: number; color_code: string | null;
}

const columns: Column<Crew>[] = [
  { key: 'crew_name', header: 'Crew', render: (row) => <div className="flex items-center gap-2">{row.color_code && <div className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color_code }} />}<span className="font-medium">{row.crew_name}</span></div> },
  { key: 'division', header: 'Division', render: (row) => <span className="text-sm capitalize">{row.division.replace(/_/g, ' ')}</span> },
  { key: 'crew_leader_name', header: 'Leader', render: (row) => <span className="text-sm">{row.crew_leader_name ?? '-'}</span> },
  { key: 'member_count', header: 'Members', render: (row) => <span className="text-sm">{row.member_count}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function CrewListPage() {
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

  const { data, isLoading } = useApiList<Crew>(['crews'], '/v1/crews', params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crews"
        description="Manage crew teams"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Crew
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search crews..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_leave">On Leave</SelectItem><SelectItem value="seasonal">Seasonal</SelectItem></SelectContent></Select>
        <Select value={division} onValueChange={(v) => { setDivision(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Division" /></SelectTrigger><SelectContent><SelectItem value="all">All Divisions</SelectItem><SelectItem value="landscaping_maintenance">Maintenance</SelectItem><SelectItem value="landscaping_projects">Projects</SelectItem><SelectItem value="hardscape">Hardscape</SelectItem><SelectItem value="snow_removal">Snow</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No crews found." onRowClick={(row) => navigate(`/crews/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
      <CrewFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
