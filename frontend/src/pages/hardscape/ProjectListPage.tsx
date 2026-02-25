import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Project {
  id: string; project_number: string; title: string; status: string; project_type: string;
  customer_display_name: string; estimated_value: string | null; assigned_to_name: string | null; created_at: string;
}

function fmt(v: string | null): string {
  if (!v) return '-';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(parseFloat(v));
}

const columns: Column<Project>[] = [
  { key: 'title', header: 'Project', render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.project_number}</p></div> },
  { key: 'customer_display_name', header: 'Customer', render: (row) => <span className="text-sm">{row.customer_display_name}</span> },
  { key: 'project_type', header: 'Type', render: (row) => <span className="text-sm capitalize">{row.project_type.replace(/_/g, ' ')}</span> },
  { key: 'estimated_value', header: 'Value', render: (row) => <span className="text-sm">{fmt(row.estimated_value)}</span> },
  { key: 'assigned_to_name', header: 'Assigned', render: (row) => <span className="text-sm">{row.assigned_to_name ?? '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (type !== 'all') params.project_type = type;

  const { data, isLoading } = useApiList<Project>(['hardscape-projects'], '/v1/hardscape/projects', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Hardscape Projects" description="Manage hardscape project pipeline" actions={<Button variant="outline" onClick={() => navigate('/hardscape/pipeline')}><LayoutGrid className="mr-2 h-4 w-4" />Pipeline</Button>} />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search projects..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="lead">Lead</SelectItem><SelectItem value="estimate_scheduled">Est. Scheduled</SelectItem><SelectItem value="estimate_sent">Est. Sent</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="lost">Lost</SelectItem></SelectContent></Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="patio">Patio</SelectItem><SelectItem value="retaining_wall">Retaining Wall</SelectItem><SelectItem value="walkway">Walkway</SelectItem><SelectItem value="driveway">Driveway</SelectItem><SelectItem value="fire_pit">Fire Pit</SelectItem><SelectItem value="outdoor_kitchen">Outdoor Kitchen</SelectItem><SelectItem value="full_landscape">Full Landscape</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No projects found." onRowClick={(row) => navigate(`/hardscape/projects/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
