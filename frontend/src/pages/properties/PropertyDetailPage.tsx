import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  User,
  Ruler,
  TreePine,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyVisitHistoryView } from '@/pages/reports/PropertyVisitHistoryView';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PropertyFormDialog } from './PropertyFormDialog';
import { useApiGet, useApiList, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import type { Column } from '@/components/shared/DataTable';

interface Property {
  id: string;
  customer_id: string;
  customer_display_name: string;
  property_name: string | null;
  property_type: string;
  status: string;
  service_frequency: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lot_size_sqft: number | null;
  lawn_area_sqft: number | null;
  zone: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduled_start: string;
  division_id: string;
}

interface Contract {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  total_value: string;
}

const jobColumns: Column<Job>[] = [
  {
    key: 'title',
    header: 'Job',
    render: (row) => <span className="font-medium">{row.title}</span>,
  },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'scheduled_start',
    header: 'Scheduled',
    render: (row) => (
      <span className="text-sm">
        {row.scheduled_start ? new Date(row.scheduled_start).toLocaleDateString() : '-'}
      </span>
    ),
  },
  {
    key: 'division_id',
    header: 'Division',
    render: (row) => <span className="text-sm capitalize">{row.division_id?.replace(/_/g, ' ') ?? '-'}</span>,
  },
];

const contractColumns: Column<Contract>[] = [
  {
    key: 'title',
    header: 'Contract',
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

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: property, isLoading } = useApiGet<Property>(
    ['property', id],
    `/v1/properties/${id}`,
    undefined,
    { enabled: !!id },
  );

  const { data: jobsResult } = useApiList<Job>(
    ['jobs', 'property', id],
    '/v1/jobs',
    { property_id: id, limit: 50 },
    { enabled: !!id },
  );

  const { data: contractsResult } = useApiList<Contract>(
    ['contracts', 'property', id],
    '/v1/contracts',
    { property_id: id, limit: 50 },
    { enabled: !!id },
  );

  const deleteMutation = useApiMutation('delete', `/v1/properties/${id}`, [['properties']]);

  const handleDelete = () => {
    deleteMutation.mutate(undefined as unknown, {
      onSuccess: () => {
        toast.success('Property deleted');
        navigate('/properties');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message ?? 'Failed to delete property');
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

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Property not found</p>
        <Button variant="link" onClick={() => navigate('/properties')}>
          Back to Properties
        </Button>
      </div>
    );
  }

  const address = [
    property.address_line1,
    property.address_line2,
    [property.city, property.state, property.zip].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  const displayName = property.property_name ?? property.address_line1 ?? 'Unnamed Property';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={displayName}
          description={`${property.property_type} property`}
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Details</CardTitle>
              <StatusBadge status={property.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              icon={User}
              label="Customer"
              value={property.customer_display_name}
            />
            <InfoRow icon={MapPin} label="Address" value={address || null} />
            <InfoRow
              icon={Clock}
              label="Service Frequency"
              value={property.service_frequency?.replace(/_/g, ' ')}
            />
            {property.lot_size_sqft && (
              <InfoRow
                icon={Ruler}
                label="Lot Size"
                value={`${property.lot_size_sqft.toLocaleString()} sqft`}
              />
            )}
            {property.lawn_area_sqft && (
              <InfoRow
                icon={TreePine}
                label="Lawn Area"
                value={`${property.lawn_area_sqft.toLocaleString()} sqft`}
              />
            )}
            {property.zone && (
              <InfoRow icon={MapPin} label="Zone" value={property.zone} />
            )}
            <InfoRow
              icon={Calendar}
              label="Created"
              value={new Date(property.created_at).toLocaleDateString()}
            />
            {property.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{property.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="jobs">
            <TabsList>
              <TabsTrigger value="jobs">
                Jobs ({jobsResult?.data.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="contracts">
                Contracts ({contractsResult?.data.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="gps-visits">GPS Visits</TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="mt-4">
              <DataTable
                columns={jobColumns}
                data={jobsResult?.data ?? []}
                emptyMessage="No jobs for this property."
              />
            </TabsContent>

            <TabsContent value="contracts" className="mt-4">
              <DataTable
                columns={contractColumns}
                data={contractsResult?.data ?? []}
                emptyMessage="No contracts for this property."
              />
            </TabsContent>

            <TabsContent value="gps-visits" className="mt-4">
              <PropertyVisitHistoryView propertyId={property.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PropertyFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        property={property}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Property"
        description={`Are you sure you want to delete "${displayName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
