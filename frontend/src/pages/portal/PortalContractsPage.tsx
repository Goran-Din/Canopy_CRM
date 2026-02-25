import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Contract {
  id: string;
  contract_number: string;
  service_type: string;
  status: string;
  start_date: string;
  end_date: string;
  total_value: string;
  billing_frequency: string;
}

function fmt(v: string | null): string {
  if (!v) return '$0.00';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v));
}

export default function PortalContractsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiList<Contract>(
    ['portal-contracts'],
    '/v1/portal/contracts',
    { page, limit: 25 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Contracts</h1>
        <p className="text-muted-foreground">View your service contracts and agreements.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !data?.data?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No contracts found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((contract) => (
            <Card key={contract.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{contract.contract_number}</CardTitle>
                  <StatusBadge status={contract.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Service Type</p>
                    <p className="capitalize">{contract.service_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Period</p>
                    <p>{new Date(contract.start_date).toLocaleDateString()} &ndash; {new Date(contract.end_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Value</p>
                    <p className="font-medium">{fmt(contract.total_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Billing</p>
                    <p className="capitalize">{contract.billing_frequency?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
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
