import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Template {
  id: string; title: string; category: string; division: string | null; status: string;
  version: number; step_count: number; assignment_count: number; created_at: string;
}

const columns: Column<Template>[] = [
  { key: 'title', header: 'Template', render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">v{row.version} - {row.step_count} steps</p></div> },
  { key: 'category', header: 'Category', render: (row) => <span className="text-sm capitalize">{row.category.replace(/_/g, ' ')}</span> },
  { key: 'division', header: 'Division', render: (row) => <span className="text-sm capitalize">{row.division?.replace(/_/g, ' ') ?? 'All'}</span> },
  { key: 'assignment_count', header: 'Assignments', render: (row) => <span className="text-sm">{row.assignment_count ?? 0}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function TemplateListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (category !== 'all') params.category = category;

  const { data, isLoading } = useApiList<Template>(['sop-templates'], '/v1/sops/templates', params);

  return (
    <div className="space-y-6">
      <PageHeader title="SOPs" description="Standard Operating Procedures" actions={<Button variant="outline" onClick={() => navigate('/sops/assignments')}>View Assignments</Button>} />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search templates..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="lawn_care">Lawn Care</SelectItem><SelectItem value="snow_removal">Snow</SelectItem><SelectItem value="hardscape">Hardscape</SelectItem><SelectItem value="safety">Safety</SelectItem><SelectItem value="equipment">Equipment</SelectItem><SelectItem value="customer_service">Customer Service</SelectItem><SelectItem value="quality_check">Quality Check</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No templates found." onRowClick={(row) => navigate(`/sops/templates/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
