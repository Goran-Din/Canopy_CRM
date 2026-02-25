import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Property {
  id: string;
  property_name: string;
  address_street: string;
  address_city: string;
  address_province: string;
  address_postal_code: string;
  property_type: string;
  status: string;
  lot_size: string | null;
}

export default function PortalPropertiesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiList<Property>(
    ['portal-properties'],
    '/v1/portal/properties',
    { page, limit: 25 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Properties</h1>
        <p className="text-muted-foreground">Properties linked to your account.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !data?.data?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No properties found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.data.map((prop) => (
            <Card key={prop.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{prop.property_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {prop.address_street}, {prop.address_city}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {prop.address_province} {prop.address_postal_code}
                      </p>
                      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                        <span className="capitalize">{prop.property_type?.replace(/_/g, ' ')}</span>
                        {prop.lot_size && <span>{prop.lot_size} sqft</span>}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={prop.status} />
                </div>
              </CardContent>
            </Card>
          ))}
          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="col-span-full flex items-center justify-center gap-2 pt-4">
              <button
                className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <button
                className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
