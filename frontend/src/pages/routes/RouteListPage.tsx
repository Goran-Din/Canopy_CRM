import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Route {
  id: string; route_name: string; division: string; day_of_week: string; status: string;
  crew_name: string | null; zone: string | null; stop_count: number;
}

const columns: Column<Route>[] = [
  { key: 'route_name', header: 'Route', render: (row) => <span className="font-medium">{row.route_name}</span> },
  { key: 'day_of_week', header: 'Day', render: (row) => <span className="text-sm capitalize">{row.day_of_week}</span> },
  { key: 'division', header: 'Division', render: (row) => <span className="text-sm capitalize">{row.division.replace(/_/g, ' ')}</span> },
  { key: 'crew_name', header: 'Crew', render: (row) => <span className="text-sm">{row.crew_name ?? 'Unassigned'}</span> },
  { key: 'zone', header: 'Zone', render: (row) => <span className="text-sm">{row.zone ?? '-'}</span> },
  { key: 'stop_count', header: 'Stops', render: (row) => <span className="text-sm">{row.stop_count}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function RouteListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('all');
  const [day, setDay] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (division !== 'all') params.division = division;
  if (day !== 'all') params.day_of_week = day;

  const { data, isLoading } = useApiList<Route>(['routes'], '/v1/routes', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Routes" description="Service routes and stops" />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search routes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={division} onValueChange={(v) => { setDivision(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Division" /></SelectTrigger><SelectContent><SelectItem value="all">All Divisions</SelectItem><SelectItem value="landscaping_maintenance">Maintenance</SelectItem><SelectItem value="landscaping_projects">Projects</SelectItem><SelectItem value="hardscape">Hardscape</SelectItem><SelectItem value="snow_removal">Snow</SelectItem></SelectContent></Select>
        <Select value={day} onValueChange={(v) => { setDay(v); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Day" /></SelectTrigger><SelectContent><SelectItem value="all">All Days</SelectItem><SelectItem value="monday">Monday</SelectItem><SelectItem value="tuesday">Tuesday</SelectItem><SelectItem value="wednesday">Wednesday</SelectItem><SelectItem value="thursday">Thursday</SelectItem><SelectItem value="friday">Friday</SelectItem><SelectItem value="saturday">Saturday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No routes found." onRowClick={(row) => navigate(`/routes/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
