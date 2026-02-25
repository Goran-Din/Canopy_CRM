import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';
import { ContactFormDialog } from './ContactFormDialog';

interface Contact {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  contact_type: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: boolean;
  customer_display_name: string;
  customer_id: string;
}

const columns: Column<Contact>[] = [
  {
    key: 'display_name',
    header: 'Name',
    render: (row) => (
      <div>
        <p className="font-medium">{row.display_name}</p>
        {row.job_title && <p className="text-xs text-muted-foreground">{row.job_title}</p>}
      </div>
    ),
  },
  { key: 'contact_type', header: 'Type', render: (row) => <span className="text-sm capitalize">{row.contact_type}</span> },
  { key: 'email', header: 'Email', render: (row) => <span className="text-sm">{row.email ?? '-'}</span> },
  { key: 'phone', header: 'Phone', render: (row) => <span className="text-sm">{row.phone ?? '-'}</span> },
  { key: 'customer_display_name', header: 'Customer', render: (row) => <span className="text-sm">{row.customer_display_name}</span> },
  { key: 'is_primary', header: 'Primary', render: (row) => row.is_primary ? <StatusBadge status="active" /> : null },
];

export default function ContactListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, unknown> = { page, limit: 25 };
  if (search) params.search = search;
  if (type !== 'all') params.type = type;

  const { data, isLoading } = useApiList<Contact>(['contacts'], '/v1/contacts', params);

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" description="Manage contact records" actions={<Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Contact</Button>} />
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="site">Site</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No contacts found." onRowClick={(row) => navigate(`/contacts/${row.id}`)} pagination={data?.pagination ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage } : undefined} />
      <ContactFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
