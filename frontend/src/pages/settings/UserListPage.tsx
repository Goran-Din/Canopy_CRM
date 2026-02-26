import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useApiList } from '@/hooks/useApi';
import { UserFormDialog } from './UserFormDialog';

interface UserRole {
  role: string;
  division_id: string | null;
  division_name: string | null;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  roles: UserRole[];
  created_at: string;
}

const roleColors: Record<string, string> = {
  owner: 'bg-red-100 text-red-800 border-red-200',
  div_mgr: 'bg-purple-100 text-purple-800 border-purple-200',
  coordinator: 'bg-blue-100 text-blue-800 border-blue-200',
  crew_leader: 'bg-amber-100 text-amber-800 border-amber-200',
  crew_member: 'bg-green-100 text-green-800 border-green-200',
  client: 'bg-gray-100 text-gray-800 border-gray-200',
};

const columns: Column<User>[] = [
  {
    key: 'first_name',
    header: 'Name',
    render: (row) => (
      <span className="font-medium">
        {row.first_name} {row.last_name}
      </span>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    render: (row) => <span className="text-sm">{row.email}</span>,
  },
  {
    key: 'roles',
    header: 'Roles',
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        {[...new Set(row.roles.map((r) => r.role))].map((role) => (
          <Badge
            key={role}
            variant="outline"
            className={`text-xs ${roleColors[role] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}
          >
            {role.replace(/_/g, ' ')}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: 'is_active',
    header: 'Status',
    render: (row) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {row.is_active ? 'Active' : 'Inactive'}
      </span>
    ),
  },
  {
    key: 'last_login_at',
    header: 'Last Login',
    render: (row) => (
      <span className="text-sm text-muted-foreground">
        {row.last_login_at ? new Date(row.last_login_at).toLocaleDateString() : 'Never'}
      </span>
    ),
  },
];

export default function UserListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (role !== 'all') params.role = role;
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<User>(['users'], '/v1/users', params);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="User Management"
          description="Manage user accounts, roles, and permissions"
          actions={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="div_mgr">Div Manager</SelectItem>
            <SelectItem value="coordinator">Coordinator</SelectItem>
            <SelectItem value="crew_leader">Crew Leader</SelectItem>
            <SelectItem value="crew_member">Crew Member</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No users found."
        onRowClick={(row) => navigate(`/settings/users/${row.id}`)}
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

      <UserFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
