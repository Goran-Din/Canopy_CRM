import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Run {
  id: string; run_number: string; run_date: string; trigger_type: string; snowfall_inches: number | null;
  temperature_f: number | null; status: string; entry_count: number;
}

const columns: Column<Run>[] = [
  { key: 'run_number', header: 'Run #', render: (row) => <span className="font-medium">{row.run_number}</span> },
  { key: 'run_date', header: 'Date', render: (row) => <span className="text-sm">{new Date(row.run_date).toLocaleDateString()}</span> },
  { key: 'trigger_type', header: 'Trigger', render: (row) => <span className="text-sm capitalize">{row.trigger_type}</span> },
  { key: 'snowfall_inches', header: 'Snowfall', render: (row) => <span className="text-sm">{row.snowfall_inches ? `${row.snowfall_inches}"` : '-'}</span> },
  { key: 'temperature_f', header: 'Temp', render: (row) => <span className="text-sm">{row.temperature_f != null ? `${row.temperature_f}°F` : '-'}</span> },
  { key: 'entry_count', header: 'Entries', render: (row) => <span className="text-sm">{row.entry_count ?? 0}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function RunListPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25, season_id: seasonId };
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Run>(['snow-runs', seasonId], '/v1/snow/runs', params);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/snow')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title="Snow Runs" description="Runs for this season" />
      </div>
      <div className="flex gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="planned">Planned</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No runs found." onRowClick={(row) => navigate(`/snow/runs/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
