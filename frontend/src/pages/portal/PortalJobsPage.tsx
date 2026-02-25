import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiList } from '@/hooks/useApi';

interface Job {
  id: string;
  property_name: string;
  property_address: string;
  service_type: string;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  crew_name: string | null;
}

export default function PortalJobsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (status !== 'all') params.status = status;

  const { data, isLoading } = useApiList<Job>(
    ['portal-jobs'],
    '/v1/portal/jobs',
    params,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Jobs</h1>
        <p className="text-muted-foreground">View scheduled and completed service visits.</p>
      </div>

      <div className="flex gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !data?.data?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No jobs found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{job.property_name}</p>
                    <p className="text-sm text-muted-foreground">{job.property_address}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Scheduled: {new Date(job.scheduled_date).toLocaleDateString()}</span>
                      {job.completed_date && <span>Completed: {new Date(job.completed_date).toLocaleDateString()}</span>}
                      <span className="capitalize">{job.service_type?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
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
