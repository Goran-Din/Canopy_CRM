import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Equipment {
  id: string; equipment_name: string; equipment_type: string; status: string;
  make: string | null; model: string | null; year: number | null;
  assigned_crew_name: string | null; serial_number: string | null;
}

const columns: Column<Equipment>[] = [
  { key: 'equipment_name', header: 'Equipment', render: (row) => <div><p className="font-medium">{row.equipment_name}</p>{(row.make || row.model) && <p className="text-xs text-muted-foreground">{[row.make, row.model, row.year].filter(Boolean).join(' ')}</p>}</div> },
  { key: 'equipment_type', header: 'Type', render: (row) => <span className="text-sm capitalize">{row.equipment_type.replace(/_/g, ' ')}</span> },
  { key: 'serial_number', header: 'Serial', render: (row) => <span className="text-sm">{row.serial_number ?? '-'}</span> },
  { key: 'assigned_crew_name', header: 'Crew', render: (row) => <span className="text-sm">{row.assigned_crew_name ?? '-'}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function EquipmentListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (type !== 'all') params.equipment_type = type;

  const { data, isLoading } = useApiList<Equipment>(['equipment'], '/v1/equipment', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Equipment" description="Manage equipment and vehicles" />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search equipment..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="truck">Truck</SelectItem><SelectItem value="trailer">Trailer</SelectItem><SelectItem value="mower">Mower</SelectItem><SelectItem value="plow">Plow</SelectItem><SelectItem value="salter">Salter</SelectItem><SelectItem value="skid_steer">Skid Steer</SelectItem><SelectItem value="excavator">Excavator</SelectItem><SelectItem value="blower">Blower</SelectItem><SelectItem value="trimmer">Trimmer</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="out_of_service">Out of Service</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent></Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No equipment found." pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
    </div>
  );
}
