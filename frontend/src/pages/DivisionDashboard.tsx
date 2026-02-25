import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Clock,
  Receipt,
  UsersRound,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useApiGet } from '@/hooks/useApi';

const divisions = [
  { value: 'all', label: 'All Divisions' },
  { value: 'landscaping_maintenance', label: 'Maintenance' },
  { value: 'landscaping_projects', label: 'Projects' },
  { value: 'hardscape', label: 'Hardscape' },
  { value: 'snow_removal', label: 'Snow' },
] as const;

interface JobStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
}

interface InvoiceStats {
  total_count: number;
  total_amount: string;
  outstanding_amount: string;
  overdue_count: number;
}

interface DisputeStats {
  total: number;
  open: number;
  in_review: number;
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DivisionDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const division = searchParams.get('division') ?? 'all';

  const queryParams = division !== 'all' ? { division_id: division } : undefined;

  const { data: jobStats, isLoading: loadingJobs } = useApiGet<JobStats>(
    ['jobs', 'stats', division],
    '/v1/jobs/stats',
    queryParams,
  );

  const { data: invoiceStats, isLoading: loadingInvoices } = useApiGet<InvoiceStats>(
    ['invoices', 'stats', division],
    '/v1/invoices/stats',
    queryParams,
  );

  const { data: disputeStats, isLoading: loadingDisputes } = useApiGet<DisputeStats>(
    ['disputes', 'stats', division],
    '/v1/disputes/stats',
    queryParams,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Division Dashboard"
        description="Division-specific metrics and activity"
      />

      <Tabs
        value={division}
        onValueChange={(value) => {
          setSearchParams(value === 'all' ? {} : { division: value });
        }}
      >
        <TabsList>
          {divisions.map((d) => (
            <TabsTrigger key={d.value} value={d.value}>
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Jobs"
          value={jobStats?.in_progress ?? 0}
          subtitle={`${jobStats?.scheduled ?? 0} upcoming`}
          icon={Briefcase}
          loading={loadingJobs}
        />
        <StatCard
          title="Completed Jobs"
          value={jobStats?.completed ?? 0}
          subtitle={`${jobStats?.total ?? 0} total`}
          icon={Clock}
          loading={loadingJobs}
        />
        <StatCard
          title="Outstanding"
          value={invoiceStats ? formatCurrency(invoiceStats.outstanding_amount) : '$0'}
          subtitle={`${invoiceStats?.overdue_count ?? 0} overdue`}
          icon={Receipt}
          loading={loadingInvoices}
        />
        <StatCard
          title="Open Disputes"
          value={disputeStats?.open ?? 0}
          subtitle={`${disputeStats?.in_review ?? 0} in review`}
          icon={AlertTriangle}
          loading={loadingDisputes}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" />
              Job Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-4">
                <ProgressRow
                  label="Scheduled"
                  value={jobStats?.scheduled ?? 0}
                  total={jobStats?.total ?? 1}
                  color="bg-blue-500"
                />
                <ProgressRow
                  label="In Progress"
                  value={jobStats?.in_progress ?? 0}
                  total={jobStats?.total ?? 1}
                  color="bg-amber-500"
                />
                <ProgressRow
                  label="Completed"
                  value={jobStats?.completed ?? 0}
                  total={jobStats?.total ?? 1}
                  color="bg-green-500"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="h-4 w-4" />
              Revenue Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Invoiced</span>
                  <span className="font-medium">
                    {invoiceStats ? formatCurrency(invoiceStats.total_amount) : '$0'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-medium text-amber-600">
                    {invoiceStats ? formatCurrency(invoiceStats.outstanding_amount) : '$0'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Invoices</span>
                  <span className="font-medium">{invoiceStats?.total_count ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Overdue</span>
                  <span className="font-medium text-red-600">
                    {invoiceStats?.overdue_count ?? 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
