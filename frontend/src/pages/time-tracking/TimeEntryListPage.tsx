import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface TimeEntry {
  id: string; user_name: string; job_title: string | null; crew_name: string | null;
  clock_in: string; clock_out: string | null; total_minutes: number | null;
  break_minutes: number; status: string; clock_in_method: string;
}

function formatDuration(mins: number | null): string {
  if (!mins) return '-';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const columns: Column<TimeEntry>[] = [
  { key: 'user_name', header: 'Employee', render: (row) => <span className="font-medium">{row.user_name}</span> },
  { key: 'crew_name', header: 'Crew', render: (row) => <span className="text-sm">{row.crew_name ?? '-'}</span> },
  { key: 'clock_in', header: 'Clock In', render: (row) => <span className="text-sm">{new Date(row.clock_in).toLocaleString()}</span> },
  { key: 'clock_out', header: 'Clock Out', render: (row) => <span className="text-sm">{row.clock_out ? new Date(row.clock_out).toLocaleString() : <StatusBadge status="active" />}</span> },
  { key: 'total_minutes', header: 'Duration', render: (row) => <span className="text-sm">{formatDuration(row.total_minutes)}</span> },
  { key: 'break_minutes', header: 'Break', render: (row) => <span className="text-sm">{row.break_minutes > 0 ? `${row.break_minutes}m` : '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function TimeEntryListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (status !== 'all') params.status = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading } = useApiList<TimeEntry>(['time-entries'], '/v1/time-entries', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Time Tracking" description="Employee time entries" actions={<Button variant="outline" onClick={() => navigate('/time-tracking/timesheet')}><Clock className="mr-2 h-4 w-4" />Timesheet</Button>} />
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="clocked_in">Clocked In</SelectItem><SelectItem value="clocked_out">Clocked Out</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="disputed">Disputed</SelectItem></SelectContent></Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-[160px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[160px]" placeholder="To" />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No time entries found." pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
