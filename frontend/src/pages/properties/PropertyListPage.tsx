import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';
import type { Column } from '@/components/shared/DataTable';
import { PropertyFormDialog } from './PropertyFormDialog';

interface Property {
  id: string;
  property_name: string | null;
  property_type: string;
  status: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  zone: string | null;
  customer_display_name: string;
  customer_id: string;
  service_frequency: string;
}

const columns: Column<Property>[] = [
  {
    key: 'property_name',
    header: 'Property',
    render: (row) => (
      <div>
        <p className="font-medium">{row.property_name ?? row.address_line1 ?? 'Unnamed'}</p>
        {row.address_line1 && row.property_name && (
          <p className="text-xs text-muted-foreground">{row.address_line1}</p>
        )}
      </div>
    ),
  },
  {
    key: 'customer_display_name',
    header: 'Customer',
    render: (row) => <span className="text-sm">{row.customer_display_name}</span>,
  },
  {
    key: 'city',
    header: 'City',
    render: (row) => (
      <span className="text-sm">{[row.city, row.state].filter(Boolean).join(', ') || '-'}</span>
    ),
  },
  {
    key: 'property_type',
    header: 'Type',
    render: (row) => <span className="text-sm capitalize">{row.property_type}</span>,
  },
  {
    key: 'service_frequency',
    header: 'Frequency',
    render: (row) => <span className="text-sm capitalize">{row.service_frequency.replace(/_/g, ' ')}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function PropertyListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (status !== 'all') params.status = status;
  if (type !== 'all') params.type = type;

  const { data, isLoading } = useApiList<Property>(
    ['properties'],
    '/v1/properties',
    params,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage service properties"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Property
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search properties..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="hoa">HOA</SelectItem>
            <SelectItem value="municipal">Municipal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No properties found."
        onRowClick={(row) => navigate(`/properties/${row.id}`)}
        pagination={
          data?.pagination
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <PropertyFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
      />
    </div>
  );
}
