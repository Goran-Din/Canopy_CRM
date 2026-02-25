import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Transition {
  id: string;
  transition_type: string;
  season_year: number;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  checklist: { task: string; completed: boolean }[];
}

const typeLabels: Record<string, string> = {
  spring_startup: 'Spring Startup',
  fall_cleanup: 'Fall Cleanup',
  winter_prep: 'Winter Prep',
  spring_to_summer: 'Spring to Summer',
  summer_to_fall: 'Summer to Fall',
};

const columns: Column<Transition>[] = [
  {
    key: 'transition_type', header: 'Type',
    render: (row) => <span className="font-medium">{typeLabels[row.transition_type] || row.transition_type}</span>,
  },
  { key: 'season_year', header: 'Year', render: (row) => <span className="text-sm">{row.season_year}</span> },
  { key: 'scheduled_date', header: 'Scheduled', render: (row) => <span className="text-sm">{new Date(row.scheduled_date).toLocaleDateString()}</span> },
  { key: 'completed_date', header: 'Completed', render: (row) => <span className="text-sm">{row.completed_date ? new Date(row.completed_date).toLocaleDateString() : '-'}</span> },
  {
    key: 'checklist', header: 'Progress',
    render: (row) => {
      const done = (row.checklist ?? []).filter((c) => c.completed).length;
      const total = (row.checklist ?? []).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <span className="text-xs text-muted-foreground">{done}/{total}</span>
        </div>
      );
    },
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function SeasonalListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (type !== 'all') params.transition_type = type;
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Transition>(['seasonal'], '/v1/seasonal', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Seasonal Transitions" description="Manage seasonal changeovers" />
      <div className="flex flex-wrap gap-3">
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="spring_startup">Spring Startup</SelectItem>
            <SelectItem value="fall_cleanup">Fall Cleanup</SelectItem>
            <SelectItem value="winter_prep">Winter Prep</SelectItem>
            <SelectItem value="spring_to_summer">Spring to Summer</SelectItem>
            <SelectItem value="summer_to_fall">Summer to Fall</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No seasonal transitions found."
        onRowClick={(row) => navigate(`/seasonal/${row.id}`)}
        pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined}
      />
    </div>
  );
}
