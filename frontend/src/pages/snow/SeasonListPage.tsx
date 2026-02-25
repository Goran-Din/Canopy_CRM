import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiList } from '@/hooks/useApi';

interface Season {
  id: string; season_name: string; start_date: string; end_date: string; status: string;
  default_trigger_inches: number; run_count: number;
}

const columns: Column<Season>[] = [
  { key: 'season_name', header: 'Season', render: (row) => <span className="font-medium">{row.season_name}</span> },
  { key: 'start_date', header: 'Start', render: (row) => <span className="text-sm">{new Date(row.start_date).toLocaleDateString()}</span> },
  { key: 'end_date', header: 'End', render: (row) => <span className="text-sm">{new Date(row.end_date).toLocaleDateString()}</span> },
  { key: 'default_trigger_inches', header: 'Trigger (in)', render: (row) => <span className="text-sm">{row.default_trigger_inches}"</span> },
  { key: 'run_count', header: 'Runs', render: (row) => <span className="text-sm">{row.run_count ?? 0}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function SeasonListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Season>(['snow-seasons'], '/v1/snow/seasons', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Snow Seasons" description="Manage snow removal seasons" />
      <div className="flex gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="planning">Planning</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No seasons found." onRowClick={(row) => navigate(`/snow/seasons/${row.id}/runs`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
