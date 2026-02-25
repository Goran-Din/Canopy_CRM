import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Assignment {
  id: string; template_title: string; job_title: string | null; crew_name: string | null;
  status: string; completion_percentage: number; assigned_date: string | null; created_at: string;
}

const columns: Column<Assignment>[] = [
  { key: 'template_title', header: 'Template', render: (row) => <span className="font-medium">{row.template_title}</span> },
  { key: 'job_title', header: 'Job', render: (row) => <span className="text-sm">{row.job_title ?? '-'}</span> },
  { key: 'crew_name', header: 'Crew', render: (row) => <span className="text-sm">{row.crew_name ?? '-'}</span> },
  { key: 'assigned_date', header: 'Assigned', render: (row) => <span className="text-sm">{row.assigned_date ? new Date(row.assigned_date).toLocaleDateString() : '-'}</span> },
  {
    key: 'completion_percentage', header: 'Progress', render: (row) => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-20 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${row.completion_percentage}%` }} /></div>
        <span className="text-xs text-muted-foreground">{Math.round(row.completion_percentage)}%</span>
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function AssignmentListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Assignment>(['sop-assignments'], '/v1/sops/assignments', params);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sops')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title="SOP Assignments" description="Track SOP completion" />
      </div>
      <div className="flex gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No assignments found." pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
