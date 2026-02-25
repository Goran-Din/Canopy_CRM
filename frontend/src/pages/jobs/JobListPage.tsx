import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';
import { JobFormDialog } from './JobFormDialog';

interface Job {
  id: string; title: string; status: string; priority: string; division: string; job_type: string;
  customer_display_name: string; property_name: string | null; scheduled_date: string | null;
  assigned_crew_name: string | null; created_at: string;
}

const columns: Column<Job>[] = [
  { key: 'title', header: 'Job', render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground capitalize">{row.job_type.replace(/_/g, ' ')}</p></div> },
  { key: 'customer_display_name', header: 'Customer', render: (row) => <span className="text-sm">{row.customer_display_name}</span> },
  { key: 'division', header: 'Division', render: (row) => <span className="text-sm capitalize">{row.division.replace(/_/g, ' ')}</span> },
  { key: 'scheduled_date', header: 'Scheduled', render: (row) => <span className="text-sm">{row.scheduled_date ? new Date(row.scheduled_date).toLocaleDateString() : '-'}</span> },
  { key: 'assigned_crew_name', header: 'Crew', render: (row) => <span className="text-sm">{row.assigned_crew_name ?? '-'}</span> },
  { key: 'priority', header: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function JobListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [division, setDivision] = useState('all');
  const [priority, setPriority] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (division !== 'all') params.division = division;
  if (priority !== 'all') params.priority = priority;

  const { data, isLoading } = useApiList<Job>(['jobs'], '/v1/jobs', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" description="Manage work orders and jobs" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/jobs/schedule')}><CalendarDays className="mr-2 h-4 w-4" />Schedule</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Job</Button>
        </div>
      } />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search jobs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="unscheduled">Unscheduled</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={division} onValueChange={(v) => { setDivision(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Division" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            <SelectItem value="landscaping_maintenance">Maintenance</SelectItem>
            <SelectItem value="landscaping_projects">Projects</SelectItem>
            <SelectItem value="hardscape">Hardscape</SelectItem>
            <SelectItem value="snow_removal">Snow</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No jobs found." onRowClick={(row) => navigate(`/jobs/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
      <JobFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
