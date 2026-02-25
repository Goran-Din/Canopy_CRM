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
import { CustomerFormDialog } from './CustomerFormDialog';

interface Customer {
  id: string;
  customer_type: string;
  status: string;
  display_name: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  billing_city: string | null;
  created_at: string;
}

const columns: Column<Customer>[] = [
  {
    key: 'display_name',
    header: 'Name',
    render: (row) => (
      <div>
        <p className="font-medium">{row.display_name}</p>
        {row.company_name && (
          <p className="text-xs text-muted-foreground">{row.company_name}</p>
        )}
      </div>
    ),
  },
  {
    key: 'customer_type',
    header: 'Type',
    render: (row) => (
      <span className="capitalize text-sm">{row.customer_type}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'email',
    header: 'Email',
    render: (row) => (
      <span className="text-sm">{row.email ?? '-'}</span>
    ),
  },
  {
    key: 'phone',
    header: 'Phone',
    render: (row) => (
      <span className="text-sm">{row.phone ?? '-'}</span>
    ),
  },
  {
    key: 'billing_city',
    header: 'City',
    render: (row) => (
      <span className="text-sm">{row.billing_city ?? '-'}</span>
    ),
  },
];

export default function CustomerListPage() {
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

  const { data, isLoading } = useApiList<Customer>(
    ['customers'],
    '/v1/customers',
    params,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customer accounts"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
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
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
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
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No customers found."
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
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

      <CustomerFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
      />
    </div>
  );
}
