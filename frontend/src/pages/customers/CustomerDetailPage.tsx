import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CustomerFormDialog } from './CustomerFormDialog';
import { useApiGet, useApiList, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import type { Column } from '@/components/shared/DataTable';

interface Customer {
  id: string;
  customer_type: string;
  status: string;
  source: string;
  display_name: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface Property {
  id: string;
  property_name: string | null;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  status: string;
}

interface Contract {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  total_value: string;
  start_date: string;
  end_date: string;
}

const propertyColumns: Column<Property>[] = [
  {
    key: 'property_name',
    header: 'Name',
    render: (row) => (
      <Link to={`/properties/${row.id}`} className="font-medium text-primary hover:underline">
        {row.property_name ?? row.address_line1}
      </Link>
    ),
  },
  {
    key: 'address_line1',
    header: 'Address',
    render: (row) => (
      <span className="text-sm">{`${row.city}, ${row.state}`}</span>
    ),
  },
  { key: 'property_type', header: 'Type', render: (row) => <span className="text-sm capitalize">{row.property_type}</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

const contractColumns: Column<Contract>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (row) => (
      <div>
        <p className="font-medium">{row.title}</p>
        <p className="text-xs text-muted-foreground">{row.contract_number}</p>
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'total_value',
    header: 'Value',
    render: (row) => (
      <span className="text-sm">
        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
          parseFloat(row.total_value),
        )}
      </span>
    ),
  },
  {
    key: 'start_date',
    header: 'Period',
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.start_date).toLocaleDateString()} - {new Date(row.end_date).toLocaleDateString()}
      </span>
    ),
  },
];

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: customer, isLoading } = useApiGet<Customer>(
    ['customer', id],
    `/v1/customers/${id}`,
    undefined,
    { enabled: !!id },
  );

  const { data: propertiesResult } = useApiList<Property>(
    ['properties', 'customer', id],
    '/v1/properties',
    { customer_id: id, limit: 50 },
    { enabled: !!id },
  );

  const { data: contractsResult } = useApiList<Contract>(
    ['contracts', 'customer', id],
    '/v1/contracts',
    { customer_id: id, limit: 50 },
    { enabled: !!id },
  );

  const deleteMutation = useApiMutation('delete', `/v1/customers/${id}`, [['customers']]);

  const handleDelete = () => {
    deleteMutation.mutate(undefined as unknown, {
      onSuccess: () => {
        toast.success('Customer deleted');
        navigate('/customers');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message ?? 'Failed to delete customer');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Customer not found</p>
        <Button variant="link" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
      </div>
    );
  }

  const address = [
    customer.billing_address_line1,
    customer.billing_address_line2,
    [customer.billing_city, customer.billing_state, customer.billing_zip]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={customer.display_name}
          description={`${customer.customer_type} customer`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEdit(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" size="icon" onClick={() => setShowDelete(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Details</CardTitle>
              <StatusBadge status={customer.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={User} label="Name" value={`${customer.first_name} ${customer.last_name}`} />
            {customer.company_name && (
              <InfoRow icon={Building} label="Company" value={customer.company_name} />
            )}
            <InfoRow icon={Mail} label="Email" value={customer.email} />
            <InfoRow icon={Phone} label="Phone" value={customer.phone} />
            {customer.mobile && (
              <InfoRow icon={Phone} label="Mobile" value={customer.mobile} />
            )}
            <InfoRow icon={MapPin} label="Address" value={address || null} />
            <InfoRow
              icon={Calendar}
              label="Created"
              value={new Date(customer.created_at).toLocaleDateString()}
            />
            {customer.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
            {customer.tags.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Related Records */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="properties">
            <TabsList>
              <TabsTrigger value="properties">
                Properties ({propertiesResult?.data.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="contracts">
                Contracts ({contractsResult?.data.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="mt-4">
              <DataTable
                columns={propertyColumns}
                data={propertiesResult?.data ?? []}
                emptyMessage="No properties linked to this customer."
                onRowClick={(row) => navigate(`/properties/${row.id}`)}
              />
            </TabsContent>

            <TabsContent value="contracts" className="mt-4">
              <DataTable
                columns={contractColumns}
                data={contractsResult?.data ?? []}
                emptyMessage="No contracts for this customer."
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CustomerFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        customer={customer}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Customer"
        description={`Are you sure you want to delete "${customer.display_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
