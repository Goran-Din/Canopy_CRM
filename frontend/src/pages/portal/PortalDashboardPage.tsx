import { useNavigate } from 'react-router-dom';
import { FileText, Briefcase, Receipt, Home, ArrowRight, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet } from '@/hooks/useApi';

interface DashboardData {
  contracts: { id: string; service_type: string; status: string; start_date: string; end_date: string }[];
  upcoming_jobs: { id: string; property_name: string; scheduled_date: string; status: string; service_type: string }[];
  recent_invoices: { id: string; invoice_number: string; status: string; total: string; balance_due: string; due_date: string }[];
  summary: { active_contracts: number; upcoming_jobs: number; outstanding_balance: string };
}

function fmt(v: string | number | null): string {
  if (!v) return '$0.00';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof v === 'string' ? parseFloat(v) : v,
  );
}

export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useApiGet<DashboardData>(
    ['portal-dashboard'],
    '/v1/portal/dashboard',
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your account.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/portal/contracts')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary?.active_contracts ?? 0}</p>
              <p className="text-sm text-muted-foreground">Active Contracts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/portal/jobs')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Briefcase className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary?.upcoming_jobs ?? 0}</p>
              <p className="text-sm text-muted-foreground">Upcoming Jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/portal/invoices')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Receipt className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmt(summary?.outstanding_balance ?? '0')}</p>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/portal/files')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Files</p>
                <p className="text-sm text-muted-foreground">Documents & photos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Upcoming Jobs</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/jobs')}>
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {!data?.upcoming_jobs?.length ? (
            <p className="text-sm text-muted-foreground">No upcoming jobs scheduled.</p>
          ) : (
            <div className="space-y-3">
              {data.upcoming_jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{job.property_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.scheduled_date).toLocaleDateString()} &middot; {job.service_type?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Invoices</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/invoices')}>
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {!data?.recent_invoices?.length ? (
            <p className="text-sm text-muted-foreground">No invoices found.</p>
          ) : (
            <div className="space-y-3">
              {data.recent_invoices.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/portal/invoices/${inv.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">Due {new Date(inv.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">{fmt(inv.total)}</p>
                      {parseFloat(inv.balance_due) > 0 && (
                        <p className="text-xs text-amber-600">Balance: {fmt(inv.balance_due)}</p>
                      )}
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
