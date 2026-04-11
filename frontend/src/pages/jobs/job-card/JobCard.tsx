import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiGet } from '@/hooks/useApi';
import { JobCardHeader } from './JobCardHeader';
import { OverviewTab } from './tabs/OverviewTab';
import { QuoteTab } from './tabs/QuoteTab';
import { DiaryTab } from './tabs/DiaryTab';
import { PhotosTab } from './tabs/PhotosTab';
import { BillingTab } from './tabs/BillingTab';
import { HistoryTab } from './tabs/HistoryTab';
import { FilesTab } from './tabs/FilesTab';

export interface JobDetail {
  id: string;
  job_number: string;
  title: string;
  status: string;
  priority: string;
  division: string;
  job_type: string;
  customer_id: string;
  customer_display_name: string;
  property_id: string;
  property_name: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_category: string | null;
  property_lot_size: string | null;
  contract_id: string | null;
  contract_tier: string | null;
  contract_price: string | null;
  contract_season_start: string | null;
  contract_season_end: string | null;
  description: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  estimated_duration_minutes: number | null;
  assigned_crew_id: string | null;
  assigned_crew_name: string | null;
  crew_leader_name: string | null;
  special_crew_instructions: string | null;
  dogs_on_property: string | null;
  notes: string | null;
  occurrence_number: number | null;
  total_occurrences: number | null;
  last_visited: string | null;
  quote_id: string | null;
  created_at: string;
}

export default function JobCard() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab || 'overview';

  const { data: job, isLoading, refetch } = useApiGet<JobDetail>(
    ['job', id],
    `/v1/jobs/${id}`,
    undefined,
    { enabled: !!id },
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return <p className="p-6 text-muted-foreground">Job not found.</p>;
  }

  return (
    <div className="space-y-4">
      <JobCardHeader job={job} onStatusChange={refetch} />

      <Tabs
        value={activeTab}
        onValueChange={(t) => navigate(`/jobs/${id}/${t}`, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quote">Quote</TabsTrigger>
          <TabsTrigger value="diary">Diary</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab job={job} /></TabsContent>
        <TabsContent value="quote"><QuoteTab jobId={job.id} quoteId={job.quote_id} /></TabsContent>
        <TabsContent value="diary"><DiaryTab jobId={job.id} /></TabsContent>
        <TabsContent value="photos"><PhotosTab jobId={job.id} customerId={job.customer_id} /></TabsContent>
        <TabsContent value="billing"><BillingTab jobId={job.id} /></TabsContent>
        <TabsContent value="history"><HistoryTab jobId={job.id} /></TabsContent>
        <TabsContent value="files"><FilesTab jobId={job.id} customerId={job.customer_id} /></TabsContent>
      </Tabs>
    </div>
  );
}
