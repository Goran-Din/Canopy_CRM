import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { useState } from 'react';
import { KpiCards, type DashboardData } from './KpiCards';
import { BillingBadge } from './components/BillingBadge';
import { DraftsSection } from './sections/DraftsSection';
import { AwaitingPaymentSection } from './sections/AwaitingPaymentSection';
import { OverdueSection } from './sections/OverdueSection';
import { PaidSection } from './sections/PaidSection';
import { HardscapeSection } from './sections/HardscapeSection';

export default function BillingDashboard() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const activeSection = section || 'drafts';
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const { data: dashboard, isLoading, refetch } = useApiGet<DashboardData>(
    ['billing-dashboard'], '/v1/billing/dashboard',
  );

  const generateMut = useApiMutation<void, void>(
    'post', '/v1/billing/generate-drafts', [['billing-dashboard'], ['billing-drafts']],
  );

  const handleGenerate = async () => {
    try {
      await generateMut.mutateAsync(undefined as never);
      toast.success('Drafts generated');
      setConfirmGenerate(false);
      refetch();
    } catch { toast.error('Failed to generate drafts.'); }
  };

  if (isLoading || !dashboard) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-4 gap-4">{Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Billing Dashboard" />
        <Button onClick={() => setConfirmGenerate(true)}>Generate Drafts</Button>
      </div>

      <KpiCards dashboard={dashboard} />

      <Tabs value={activeSection} onValueChange={(s) => navigate(`/billing/${s}`, { replace: true })}>
        <TabsList>
          <TabsTrigger value="drafts">Drafts <BillingBadge count={dashboard.drafts_count} /></TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting <BillingBadge count={dashboard.awaiting_count} /></TabsTrigger>
          <TabsTrigger value="overdue">Overdue <BillingBadge count={dashboard.overdue_count} variant="danger" /></TabsTrigger>
          <TabsTrigger value="paid">Paid <BillingBadge count={dashboard.paid_month_count} /></TabsTrigger>
          <TabsTrigger value="hardscape">Hardscape <BillingBadge count={dashboard.hardscape_count} /></TabsTrigger>
        </TabsList>

        <TabsContent value="drafts"><DraftsSection /></TabsContent>
        <TabsContent value="awaiting"><AwaitingPaymentSection /></TabsContent>
        <TabsContent value="overdue"><OverdueSection /></TabsContent>
        <TabsContent value="paid"><PaidSection /></TabsContent>
        <TabsContent value="hardscape"><HardscapeSection /></TabsContent>
      </Tabs>

      <ConfirmDialog open={confirmGenerate} onOpenChange={setConfirmGenerate} title="Generate Drafts" description="Generate invoice drafts for all contracts with billing due this month?" onConfirm={handleGenerate} />
    </div>
  );
}
