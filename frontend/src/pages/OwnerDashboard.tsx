import {
  Users,
  FileText,
  Briefcase,
  Receipt,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useApiGet } from '@/hooks/useApi';

interface CustomerStats {
  total: number;
  active: number;
  lead: number;
  prospect: number;
}

interface ContractStats {
  total: number;
  active: number;
  draft: number;
  expiring_soon: number;
}

interface JobStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
}

interface InvoiceStats {
  total_count: number;
  total_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  overdue_count: number;
  overdue_amount: string;
}

interface DisputeStats {
  total: number;
  open: number;
  in_review: number;
  resolved: number;
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

function formatCurrency(amount: string | number | undefined | null): string {
  if (amount === null || amount === undefined || amount === '') return '$0';
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function OwnerDashboard() {
  const { data: customerStats, isLoading: loadingCustomers } =
    useApiGet<CustomerStats>(['customers', 'stats'], '/v1/customers/stats');

  const { data: contractStats, isLoading: loadingContracts } =
    useApiGet<ContractStats>(['contracts', 'stats'], '/v1/contracts/stats');

  const { data: jobStats, isLoading: loadingJobs } =
    useApiGet<JobStats>(['jobs', 'stats'], '/v1/jobs/stats');

  const { data: invoiceStats, isLoading: loadingInvoices } =
    useApiGet<InvoiceStats>(['invoices', 'stats'], '/v1/invoices/stats');

  const { data: disputeStats, isLoading: loadingDisputes } =
    useApiGet<DisputeStats>(['disputes', 'stats'], '/v1/disputes/stats');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Business overview and key metrics"
      />

      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Customers"
          value={customerStats?.active ?? 0}
          subtitle={`${customerStats?.total ?? 0} total`}
          icon={Users}
          loading={loadingCustomers}
        />
        <StatCard
          title="Active Contracts"
          value={contractStats?.active ?? 0}
          subtitle={`${contractStats?.expiring_soon ?? 0} expiring soon`}
          icon={FileText}
          loading={loadingContracts}
        />
        <StatCard
          title="Jobs In Progress"
          value={jobStats?.in_progress ?? 0}
          subtitle={`${jobStats?.scheduled ?? 0} scheduled`}
          icon={Briefcase}
          loading={loadingJobs}
        />
        <StatCard
          title="Outstanding Revenue"
          value={invoiceStats ? formatCurrency(invoiceStats.outstanding_amount) : '$0'}
          subtitle={`${invoiceStats?.overdue_count ?? 0} overdue`}
          icon={DollarSign}
          loading={loadingInvoices}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={invoiceStats ? formatCurrency(invoiceStats.total_amount) : '$0'}
          subtitle={`${invoiceStats ? formatCurrency(invoiceStats.paid_amount) : '$0'} collected`}
          icon={TrendingUp}
          loading={loadingInvoices}
        />
        <StatCard
          title="Total Invoices"
          value={invoiceStats?.total_count ?? 0}
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
        <StatCard
          title="Completed Jobs"
          value={jobStats?.completed ?? 0}
          subtitle={`${jobStats?.total ?? 0} total`}
          icon={Clock}
          loading={loadingJobs}
        />
      </div>

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCustomers ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Leads</span>
                  <span className="font-medium">{customerStats?.lead ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prospects</span>
                  <span className="font-medium">{customerStats?.prospect ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-medium">{customerStats?.active ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingContracts ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Drafts</span>
                  <span className="font-medium">{contractStats?.draft ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-medium">{contractStats?.active ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expiring Soon</span>
                  <span className="font-medium text-amber-600">
                    {contractStats?.expiring_soon ?? 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Scheduled</span>
                  <span className="font-medium">{jobStats?.scheduled ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">In Progress</span>
                  <span className="font-medium">{jobStats?.in_progress ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">{jobStats?.completed ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
