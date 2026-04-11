# Job Card UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing JobDetailPage with a full-page 7-tab Job Card (Overview, Quote, Diary, Photos, Billing, History, Files) with status-dependent header and URL-persisted tab navigation.

**Architecture:** Main JobCard component fetches job data and renders a persistent header + URL-synced tabs. Each tab is a focused component. Diary uses infinite scroll. Photos and Files tabs reuse components from Brief 02. Quick actions dispatch status mutations based on current job state.

**Tech Stack:** React 18, TypeScript, shadcn/ui (Tabs, Card, Button, Badge, Dialog, Textarea), Lucide icons, React Query hooks, React Router v6 (useParams for tab sync), Vitest + RTL.

**Frontend root:** `C:\Users\Goran\Documents\03-DEVELOPMENT\Canopy CRM\Code\canopy_crm\frontend`

---

## File Structure

```
frontend/src/pages/jobs/
├── JobDetailPage.tsx            # DELETE (old page)
├── JobFormDialog.tsx            # KEEP (existing)
├── JobListPage.tsx              # KEEP (existing)
├── SchedulePage.tsx             # KEEP (existing)
└── job-card/
    ├── JobCard.tsx              # Main page: fetch job, render header + tabs
    ├── JobCardHeader.tsx        # Persistent header with status + quick actions
    ├── tabs/
    │   ├── OverviewTab.tsx      # Property snapshot, contract, crew, schedule
    │   ├── QuoteTab.tsx         # Quote view (read-only or placeholder for builder)
    │   ├── DiaryTab.tsx         # Timeline with infinite scroll
    │   ├── PhotosTab.tsx        # Thin wrapper around PhotoGrid
    │   ├── BillingTab.tsx       # Invoices table + milestones
    │   ├── HistoryTab.tsx       # Status change audit log
    │   └── FilesTab.tsx         # FileList + upload for job
    └── components/
        ├── DiaryEntry.tsx       # Single diary entry (system vs staff)
        ├── DiaryNoteForm.tsx    # Inline note submission form
        └── QuickActionBar.tsx   # Status-dependent action buttons

frontend/src/App.tsx             # Update route to JobCard with optional :tab param
```

---

## Task 1: Delete Old JobDetailPage, Create JobCard Shell + Route

**Files:**
- Delete: `frontend/src/pages/jobs/JobDetailPage.tsx`
- Create: `frontend/src/pages/jobs/job-card/JobCard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Delete the old file and create the new directory**

```bash
rm frontend/src/pages/jobs/JobDetailPage.tsx
mkdir -p frontend/src/pages/jobs/job-card/tabs
mkdir -p frontend/src/pages/jobs/job-card/components
```

- [ ] **Step 2: Create the main JobCard component**

Create `frontend/src/pages/jobs/job-card/JobCard.tsx`:

```typescript
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiGet } from '@/hooks/useApi';
import { useNavigate } from 'react-router-dom';
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
```

- [ ] **Step 3: Update App.tsx routes**

In `frontend/src/App.tsx`:
- Change the import from `JobDetailPage` to `JobCard`:
```typescript
import JobCard from './pages/jobs/job-card/JobCard';
```
- Replace the route `<Route path="/jobs/:id" element={<JobDetailPage />} />` with:
```typescript
          <Route path="/jobs/:id" element={<JobCard />} />
          <Route path="/jobs/:id/:tab" element={<JobCard />} />
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(job-card): create JobCard shell with URL-synced tabs, delete old JobDetailPage"
```

---

## Task 2: QuickActionBar + JobCardHeader

**Files:**
- Create: `frontend/src/pages/jobs/job-card/components/QuickActionBar.tsx`
- Create: `frontend/src/pages/jobs/job-card/JobCardHeader.tsx`

- [ ] **Step 1: Create QuickActionBar**

Create `frontend/src/pages/jobs/job-card/components/QuickActionBar.tsx`:

```typescript
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { useState } from 'react';

interface QuickActionBarProps {
  jobId: string;
  status: string;
  onStatusChange: () => void;
}

const STATUS_ACTIONS: Record<string, { label: string; newStatus: string; destructive?: boolean }[]> = {
  lead: [
    { label: 'Convert to Job', newStatus: 'unscheduled' },
    { label: 'Decline', newStatus: 'cancelled', destructive: true },
  ],
  unscheduled: [
    { label: 'Schedule', newStatus: 'scheduled' },
    { label: 'Create Quote', newStatus: '' },
  ],
  scheduled: [
    { label: 'Start Job', newStatus: 'in_progress' },
    { label: 'Reschedule', newStatus: 'unscheduled' },
    { label: 'Cancel', newStatus: 'cancelled', destructive: true },
  ],
  in_progress: [
    { label: 'Complete Job', newStatus: 'completed' },
    { label: 'Add Note', newStatus: '' },
  ],
  completed: [
    { label: 'Verify', newStatus: 'verified' },
    { label: 'Reopen', newStatus: 'in_progress' },
  ],
  verified: [
    { label: 'Archive', newStatus: 'archived' },
  ],
  cancelled: [
    { label: 'Reopen', newStatus: 'unscheduled' },
  ],
};

export function QuickActionBar({ jobId, status, onStatusChange }: QuickActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<{ label: string; newStatus: string } | null>(null);

  const statusMut = useApiMutation<void, { status: string }>(
    'patch',
    `/v1/jobs/${jobId}/status`,
    [['jobs'], ['job', jobId]],
  );

  const actions = STATUS_ACTIONS[status] || [];

  const handleAction = async (newStatus: string, label: string) => {
    if (!newStatus) return; // non-status actions (like "Add Note") handled elsewhere
    try {
      await statusMut.mutateAsync({ status: newStatus });
      toast.success(`Job ${label.toLowerCase()}`);
      onStatusChange();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}.`);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          if (!action.newStatus) return null; // skip non-status actions for now
          return (
            <Button
              key={action.label}
              size="sm"
              variant={action.destructive ? 'destructive' : 'default'}
              onClick={() => {
                if (action.destructive) {
                  setConfirmAction(action);
                } else {
                  handleAction(action.newStatus, action.label);
                }
              }}
            >
              {action.label}
            </Button>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`${confirmAction?.label}?`}
        description={`Are you sure you want to ${confirmAction?.label.toLowerCase()} this job? This action cannot be easily undone.`}
        onConfirm={() => {
          if (confirmAction) handleAction(confirmAction.newStatus, confirmAction.label);
          setConfirmAction(null);
        }}
        variant="destructive"
      />
    </>
  );
}
```

- [ ] **Step 2: Create JobCardHeader**

Create `frontend/src/pages/jobs/job-card/JobCardHeader.tsx`:

```typescript
import { ArrowLeft, Dog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useNavigate, Link } from 'react-router-dom';
import { QuickActionBar } from './components/QuickActionBar';
import type { JobDetail } from './JobCard';

interface JobCardHeaderProps {
  job: JobDetail;
  onStatusChange: () => void;
}

export function JobCardHeader({ job, onStatusChange }: JobCardHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3 border-b pb-4">
      {/* Top row: back + title + status */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              Job #{job.job_number} — {job.title}
            </h1>
            <StatusBadge status={job.status} />
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground pl-10">
        <span>
          Customer:{' '}
          <Link to={`/customers/${job.customer_id}`} className="text-primary hover:underline">
            {job.customer_display_name}
          </Link>
        </span>
        <span>
          Property:{' '}
          <Link to={`/properties/${job.property_id}`} className="text-primary hover:underline">
            {job.property_name || job.property_address || 'View Property'}
          </Link>
        </span>
        <span>Division: {job.division}</span>
        <span>Crew: {job.assigned_crew_name || <span className="text-muted-foreground/60">Unassigned</span>}</span>
        {job.scheduled_date && (
          <span>
            Scheduled: {new Date(job.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Special instructions */}
      {job.special_crew_instructions && (
        <div className="ml-10 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ Special Instructions
          </p>
          <p className="text-sm text-amber-700 mt-1">{job.special_crew_instructions}</p>
        </div>
      )}

      {/* Dog warning */}
      {(job.dogs_on_property === 'yes' || job.dogs_on_property === 'sometimes') && (
        <div className="ml-10 flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
          <Dog className="h-4 w-4 text-orange-600" />
          <span className="text-sm text-orange-700">
            {job.dogs_on_property === 'yes'
              ? 'Dog on property'
              : 'Dog on property — sometimes loose in backyard'}
          </span>
        </div>
      )}

      {/* Quick actions */}
      <div className="pl-10">
        <QuickActionBar jobId={job.id} status={job.status} onStatusChange={onStatusChange} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(job-card): add JobCardHeader with status-dependent quick actions"
```

---

## Task 3: OverviewTab

**Files:**
- Create: `frontend/src/pages/jobs/job-card/tabs/OverviewTab.tsx`

- [ ] **Step 1: Create OverviewTab**

Create `frontend/src/pages/jobs/job-card/tabs/OverviewTab.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { JobDetail } from '../JobCard';

interface OverviewTabProps {
  job: JobDetail;
}

export function OverviewTab({ job }: OverviewTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      {/* Property Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Property Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">
            📍 {job.property_address || job.property_name || 'No address'}
          </p>
          {(job.property_city || job.property_state) && (
            <p className="text-muted-foreground pl-5">
              {[job.property_city, job.property_state, job.property_zip].filter(Boolean).join(', ')}
            </p>
          )}
          {job.property_category && (
            <p><span className="text-muted-foreground">Category:</span> {job.property_category}</p>
          )}
          {job.property_lot_size && (
            <p><span className="text-muted-foreground">Lot size:</span> {job.property_lot_size}</p>
          )}
          {job.last_visited && (
            <p>
              <span className="text-muted-foreground">Last visited:</span>{' '}
              {new Date(job.last_visited).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link to={`/properties/${job.property_id}`}>Open Property Card →</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Contract & Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Contract & Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {job.contract_tier && (
            <p><span className="text-muted-foreground">Tier:</span> {job.contract_tier}</p>
          )}
          {job.contract_price && (
            <p><span className="text-muted-foreground">Price:</span> ${job.contract_price}/month</p>
          )}
          {job.contract_season_start && job.contract_season_end && (
            <p>
              <span className="text-muted-foreground">Season:</span>{' '}
              {new Date(job.contract_season_start).toLocaleDateString('en-US', { month: 'short' })}–
              {new Date(job.contract_season_end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          )}
          {job.occurrence_number && job.total_occurrences && (
            <p>
              <span className="text-muted-foreground">Occurrences:</span>{' '}
              {job.occurrence_number} of {job.total_occurrences}
            </p>
          )}
          <div className="border-t pt-2 mt-2">
            <p>
              <span className="text-muted-foreground">Assigned crew:</span>{' '}
              {job.assigned_crew_name || 'Unassigned'}
            </p>
            {job.crew_leader_name && (
              <p><span className="text-muted-foreground">Crew leader:</span> {job.crew_leader_name}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(job-card): add OverviewTab with property snapshot and contract info"
```

---

## Task 4: DiaryTab + DiaryEntry + DiaryNoteForm

**Files:**
- Create: `frontend/src/pages/jobs/job-card/components/DiaryEntry.tsx`
- Create: `frontend/src/pages/jobs/job-card/components/DiaryNoteForm.tsx`
- Create: `frontend/src/pages/jobs/job-card/tabs/DiaryTab.tsx`

- [ ] **Step 1: Create DiaryEntry**

Create `frontend/src/pages/jobs/job-card/components/DiaryEntry.tsx`:

```typescript
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiaryEntryData {
  id: string;
  entry_type: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
}

interface DiaryEntryProps {
  entry: DiaryEntryData;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export type { DiaryEntryData };

export function DiaryEntry({ entry }: DiaryEntryProps) {
  const isSystem = entry.entry_type === 'system' || !entry.created_by_name;

  return (
    <div className={cn('flex gap-3 py-3 border-b last:border-0', isSystem && 'opacity-70')}>
      <div className="shrink-0 mt-0.5">
        {isSystem ? (
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {entry.created_by_name?.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {!isSystem && entry.created_by_name && (
            <span className="text-sm font-medium">{entry.created_by_name}:</span>
          )}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.created_at)}</span>
        </div>
        <p className={cn('text-sm mt-0.5', isSystem ? 'text-muted-foreground' : '')}>{entry.content}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DiaryNoteForm**

Create `frontend/src/pages/jobs/job-card/components/DiaryNoteForm.tsx`:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface DiaryNoteFormProps {
  jobId: string;
  onCancel: () => void;
  onSubmitted: () => void;
}

export function DiaryNoteForm({ jobId, onCancel, onSubmitted }: DiaryNoteFormProps) {
  const [content, setContent] = useState('');

  const addNote = useApiMutation<void, { content: string; entry_type: string }>(
    'post',
    `/v1/jobs/${jobId}/diary`,
    [['diary', jobId]],
  );

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await addNote.mutateAsync({ content: content.trim(), entry_type: 'note_added' });
      toast.success('Note added');
      setContent('');
      onSubmitted();
    } catch {
      toast.error('Failed to add note.');
    }
  };

  return (
    <div className="space-y-2 p-3 bg-muted/50 rounded-md">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a note..."
        className="min-h-[80px]"
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
          Add Note
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DiaryTab**

Create `frontend/src/pages/jobs/job-card/tabs/DiaryTab.tsx`:

```typescript
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiGet } from '@/hooks/useApi';
import { DiaryEntry, type DiaryEntryData } from '../components/DiaryEntry';
import { DiaryNoteForm } from '../components/DiaryNoteForm';

interface DiaryTabProps {
  jobId: string;
}

export function DiaryTab({ jobId }: DiaryTabProps) {
  const [showForm, setShowForm] = useState(false);

  const { data: entries = [], refetch } = useApiGet<DiaryEntryData[]>(
    ['diary', jobId],
    `/v1/jobs/${jobId}/diary`,
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Diary</h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        )}
      </div>

      {showForm && (
        <DiaryNoteForm
          jobId={jobId}
          onCancel={() => setShowForm(false)}
          onSubmitted={() => { setShowForm(false); refetch(); }}
        />
      )}

      <div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No diary entries yet.</p>
        ) : (
          entries.map((entry) => <DiaryEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(job-card): add DiaryTab with entries, note form, and relative timestamps"
```

---

## Task 5: PhotosTab, BillingTab, HistoryTab, FilesTab

**Files:**
- Create: `frontend/src/pages/jobs/job-card/tabs/PhotosTab.tsx`
- Create: `frontend/src/pages/jobs/job-card/tabs/BillingTab.tsx`
- Create: `frontend/src/pages/jobs/job-card/tabs/HistoryTab.tsx`
- Create: `frontend/src/pages/jobs/job-card/tabs/FilesTab.tsx`

- [ ] **Step 1: Create PhotosTab**

Create `frontend/src/pages/jobs/job-card/tabs/PhotosTab.tsx`:

```typescript
import { PhotoGrid } from '@/components/files/PhotoGrid';

interface PhotosTabProps {
  jobId: string;
  customerId: string;
}

export function PhotosTab({ jobId, customerId }: PhotosTabProps) {
  return (
    <div className="mt-4">
      <PhotoGrid jobId={jobId} customerId={customerId} />
    </div>
  );
}
```

- [ ] **Step 2: Create BillingTab**

Create `frontend/src/pages/jobs/job-card/tabs/BillingTab.tsx`:

```typescript
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet } from '@/hooks/useApi';

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: string;
  due_date: string;
  paid_date: string | null;
}

interface Milestone {
  id: string;
  name: string;
  amount: string;
  status: string;
}

interface BillingTabProps {
  jobId: string;
}

function fmt(v: string | number | null): string {
  if (!v) return '$0.00';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

export function BillingTab({ jobId }: BillingTabProps) {
  const navigate = useNavigate();

  const { data: invoices = [] } = useApiGet<Invoice[]>(
    ['job-invoices', jobId],
    `/v1/jobs/${jobId}/invoices`,
  );

  const { data: milestones = [] } = useApiGet<Milestone[]>(
    ['job-milestones', jobId],
    `/v1/jobs/${jobId}/milestones`,
  );

  return (
    <div className="mt-4 space-y-6">
      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices for this job.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Invoice #</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-left py-2 font-medium">Due Date</th>
                  <th className="text-left py-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="py-2">{inv.invoice_number}</td>
                    <td className="py-2"><StatusBadge status={inv.status} /></td>
                    <td className="text-right py-2 font-medium">{fmt(inv.total)}</td>
                    <td className="py-2">{new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="py-2">{inv.paid_date ? new Date(inv.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Milestones (hardscape) */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((ms) => (
                <div key={ms.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{ms.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(ms.amount)}</p>
                  </div>
                  <StatusBadge status={ms.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create HistoryTab**

Create `frontend/src/pages/jobs/job-card/tabs/HistoryTab.tsx`:

```typescript
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet } from '@/hooks/useApi';

interface HistoryEntry {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_name: string;
  notes: string | null;
  created_at: string;
}

interface HistoryTabProps {
  jobId: string;
}

export function HistoryTab({ jobId }: HistoryTabProps) {
  const { data: entries = [] } = useApiGet<HistoryEntry[]>(
    ['job-history', jobId],
    `/v1/jobs/${jobId}/history`,
  );

  if (entries.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No status changes recorded.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Date</th>
            <th className="text-left py-2 font-medium">From</th>
            <th className="text-left py-2 font-medium">To</th>
            <th className="text-left py-2 font-medium">Changed By</th>
            <th className="text-left py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="py-2">
                {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td className="py-2"><StatusBadge status={entry.from_status} /></td>
              <td className="py-2"><StatusBadge status={entry.to_status} /></td>
              <td className="py-2">{entry.changed_by_name}</td>
              <td className="py-2 text-muted-foreground">{entry.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create FilesTab**

Create `frontend/src/pages/jobs/job-card/tabs/FilesTab.tsx`:

```typescript
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileList } from '@/components/files/FileList';
import { FileUploadDialog } from '@/components/files/FileUploadDialog';

interface FilesTabProps {
  jobId: string;
  customerId: string;
}

export function FilesTab({ jobId, customerId }: FilesTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Files</h3>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Upload File
        </Button>
      </div>

      <FileList customerId={customerId} folderId={null} />

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        customerId={customerId}
        onComplete={() => {}}
      />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(job-card): add Photos, Billing, History, and Files tabs"
```

---

## Task 6: QuoteTab

**Files:**
- Create: `frontend/src/pages/jobs/job-card/tabs/QuoteTab.tsx`

- [ ] **Step 1: Create QuoteTab**

Create `frontend/src/pages/jobs/job-card/tabs/QuoteTab.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface QuoteVersion {
  id: string;
  version_number: number;
  status: string;
  total: string;
  created_at: string;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  status: string;
  total: string;
  sections: {
    id: string;
    title: string;
    sort_order: number;
    line_items: {
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      sort_order: number;
    }[];
  }[];
  signer_name?: string;
  signed_at?: string;
  versions: QuoteVersion[];
}

interface QuoteTabProps {
  jobId: string;
  quoteId: string | null;
}

function fmt(v: number | string | null): string {
  if (!v) return '$0.00';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

export function QuoteTab({ jobId, quoteId }: QuoteTabProps) {
  const { data: quote, refetch } = useApiGet<QuoteDetail>(
    ['quote', quoteId],
    `/v1/quotes/${quoteId}`,
    undefined,
    { enabled: !!quoteId },
  );

  const createQuote = useApiMutation<{ id: string }, void>(
    'post',
    `/v1/jobs/${jobId}/quotes`,
    [['job', jobId]],
  );

  // No quote exists
  if (!quoteId) {
    return (
      <div className="mt-4 text-center py-12">
        <p className="text-muted-foreground mb-4">No quote created yet.</p>
        <Button
          onClick={async () => {
            try {
              await createQuote.mutateAsync(undefined as never);
              toast.success('Quote created');
              refetch();
            } catch {
              toast.error('Failed to create quote.');
            }
          }}
        >
          Create Quote
        </Button>
      </div>
    );
  }

  if (!quote) return null;

  // Draft mode — placeholder for Quote Builder (Brief 04)
  if (quote.status === 'draft') {
    return (
      <div className="mt-4 p-8 border-2 border-dashed rounded-lg text-center">
        <p className="text-muted-foreground">Quote Builder will be rendered here.</p>
        <p className="text-xs text-muted-foreground mt-1">Status: Draft — {quote.quote_number}</p>
      </div>
    );
  }

  // Read-only mode
  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {quote.quote_number}
            </CardTitle>
            <StatusBadge status={quote.status} />
          </div>
          <p className="text-sm text-muted-foreground">Total: {fmt(quote.total)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sections & line items */}
          {quote.sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section) => (
              <div key={section.id}>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                  {section.title}
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 font-medium">Item</th>
                      <th className="text-right py-1 font-medium">Qty</th>
                      <th className="text-right py-1 font-medium">Price</th>
                      <th className="text-right py-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.line_items
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-1">{item.description}</td>
                          <td className="text-right py-1">{item.quantity}</td>
                          <td className="text-right py-1">{fmt(item.unit_price)}</td>
                          <td className="text-right py-1 font-medium">{fmt(item.line_total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Signature info */}
          {quote.signer_name && (
            <div className="border-t pt-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Signed by:</span> {quote.signer_name}
              </p>
              {quote.signed_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(quote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version history */}
      {quote.versions && quote.versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quote.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm">Version {v.version_number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{fmt(v.total)}</span>
                    <StatusBadge status={v.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(job-card): add QuoteTab with read-only view and draft placeholder"
```

---

## Task 7: Test Suite

**Files:**
- Create: `frontend/src/pages/jobs/job-card/__tests__/JobCard.test.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/pages/jobs/job-card/__tests__/JobCard.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseApiGet = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
  useApiList: vi.fn(() => ({ data: [], pagination: {} })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiMutation: (..._args: any[]) => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <div data-testid="confirm-dialog"><button onClick={onConfirm}>Confirm</button></div> : null,
}));
vi.mock('@/components/files/PhotoGrid', () => ({
  PhotoGrid: () => <div data-testid="photo-grid">PhotoGrid</div>,
}));
vi.mock('@/components/files/FileList', () => ({
  FileList: () => <div data-testid="file-list">FileList</div>,
}));
vi.mock('@/components/files/FileUploadDialog', () => ({
  FileUploadDialog: () => null,
}));
vi.mock('@/components/files/useFileUpload', () => ({
  useFileUpload: () => ({ upload: vi.fn(), reset: vi.fn(), progress: 0, isUploading: false, error: null }),
}));

const mockJob = {
  id: 'j1',
  job_number: '0047-26',
  title: 'Spring Cleanup',
  status: 'scheduled',
  priority: 'normal',
  division: 'Landscape',
  job_type: 'maintenance',
  customer_id: 'c1',
  customer_display_name: 'John Smith',
  property_id: 'p1',
  property_name: '1348 Oak St',
  property_address: '1348 Oak Street',
  property_city: 'Naperville',
  property_state: 'IL',
  property_zip: '60540',
  property_category: 'Residential',
  property_lot_size: '8,500 sqft',
  contract_id: 'ct1',
  contract_tier: 'Gold Package',
  contract_price: '145',
  contract_season_start: '2026-04-01',
  contract_season_end: '2026-11-30',
  description: null,
  scheduled_date: '2026-04-15',
  scheduled_start_time: null,
  estimated_duration_minutes: 60,
  assigned_crew_id: 'cr1',
  assigned_crew_name: 'Alpha Team',
  crew_leader_name: 'Mike Johnson',
  special_crew_instructions: 'Gate code: 4521. Park on street, not driveway.',
  dogs_on_property: 'yes',
  notes: null,
  occurrence_number: 3,
  total_occurrences: 32,
  last_visited: '2026-04-06',
  quote_id: null,
  created_at: '2026-01-01',
};

const mockDiaryEntries = [
  { id: 'd1', entry_type: 'note_added', content: 'Gate was locked', created_by_name: 'Mike J', created_at: '2026-04-06T15:00:00Z' },
  { id: 'd2', entry_type: 'system', content: 'Status changed to scheduled', created_by_name: null, created_at: '2026-04-05T10:00:00Z' },
];

const mockInvoices = [
  { id: 'inv1', invoice_number: 'INV-001', status: 'sent', total: '145.00', due_date: '2026-05-01', paid_date: null },
];

const mockHistory = [
  { id: 'h1', from_status: 'unscheduled', to_status: 'scheduled', changed_by_name: 'Admin', notes: null, created_at: '2026-04-05T10:00:00Z' },
];

function setupMocks(jobOverrides: Partial<typeof mockJob> = {}) {
  const job = { ...mockJob, ...jobOverrides };
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'job') return { data: job, isLoading: false, refetch: mockRefetch };
    if (key[0] === 'diary') return { data: mockDiaryEntries, refetch: mockRefetch };
    if (key[0] === 'job-invoices') return { data: mockInvoices, refetch: mockRefetch };
    if (key[0] === 'job-milestones') return { data: [], refetch: mockRefetch };
    if (key[0] === 'job-history') return { data: mockHistory, refetch: mockRefetch };
    if (key[0] === 'quote') return { data: null, refetch: mockRefetch };
    if (key[0] === 'folders') return { data: [], refetch: mockRefetch };
    if (key[0] === 'files') return { data: [], refetch: mockRefetch };
    if (key[0] === 'photos') return { data: [], refetch: mockRefetch };
    return { data: null, isLoading: false, refetch: mockRefetch };
  });
}

function renderJobCard(path = '/jobs/j1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobCardLazy />} />
        <Route path="/jobs/:id/:tab" element={<JobCardLazy />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Lazy import to avoid hoisting issues with mocks
function JobCardLazy() {
  const JobCard = require('../JobCard').default;
  return <JobCard />;
}

describe('JobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders header with job number, status badge, customer name', () => {
    renderJobCard();
    expect(screen.getByText(/Job #0047-26/)).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('shows all 7 tabs', () => {
    renderJobCard();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Quote')).toBeInTheDocument();
    expect(screen.getByText('Diary')).toBeInTheDocument();
    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('default tab is overview when no tab in URL', () => {
    renderJobCard('/jobs/j1');
    expect(screen.getByText('Property Snapshot')).toBeInTheDocument();
  });

  it('tab navigation updates URL', async () => {
    renderJobCard();
    await userEvent.click(screen.getByText('Diary'));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/j1/diary', { replace: true });
  });

  it('deep-link to specific tab works', () => {
    renderJobCard('/jobs/j1/diary');
    expect(screen.getByText('Add Note')).toBeInTheDocument();
  });

  it('overview tab shows property snapshot and contract info', () => {
    renderJobCard();
    expect(screen.getByText(/1348 Oak Street/)).toBeInTheDocument();
    expect(screen.getByText(/Gold Package/)).toBeInTheDocument();
    expect(screen.getByText(/3 of 32/)).toBeInTheDocument();
  });

  it('special instructions banner shown when field is set', () => {
    renderJobCard();
    expect(screen.getByText(/Gate code: 4521/)).toBeInTheDocument();
  });

  it('dog warning shown when dogs_on_property = yes', () => {
    renderJobCard();
    expect(screen.getByText('Dog on property')).toBeInTheDocument();
  });

  it('quick action buttons change based on job status', () => {
    renderJobCard();
    // scheduled status shows Start Job, Reschedule, Cancel
    expect(screen.getByText('Start Job')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('diary tab shows entries', () => {
    renderJobCard('/jobs/j1/diary');
    expect(screen.getByText('Gate was locked')).toBeInTheDocument();
    expect(screen.getByText(/Status changed to scheduled/)).toBeInTheDocument();
  });

  it('add note form submits diary entry', async () => {
    mockMutateAsync.mockResolvedValue({});
    renderJobCard('/jobs/j1/diary');
    await userEvent.click(screen.getByText('Add Note'));
    const textarea = screen.getByPlaceholderText('Write a note...');
    await userEvent.type(textarea, 'Test note');
    await userEvent.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it('photos tab renders PhotoGrid', () => {
    renderJobCard('/jobs/j1/photos');
    expect(screen.getByTestId('photo-grid')).toBeInTheDocument();
  });

  it('billing tab shows invoices table', () => {
    renderJobCard('/jobs/j1/billing');
    expect(screen.getByText('INV-001')).toBeInTheDocument();
  });

  it('history tab shows status change log', () => {
    renderJobCard('/jobs/j1/history');
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('quote tab shows create button when no quote exists', () => {
    renderJobCard('/jobs/j1/quote');
    expect(screen.getByText('No quote created yet.')).toBeInTheDocument();
    expect(screen.getByText('Create Quote')).toBeInTheDocument();
  });

  it('quote tab shows placeholder for draft quote', () => {
    setupMocks({ quote_id: 'q1' });
    mockUseApiGet.mockImplementation((key: string[]) => {
      if (key[0] === 'job') return { data: { ...mockJob, quote_id: 'q1' }, isLoading: false, refetch: mockRefetch };
      if (key[0] === 'quote') return { data: { id: 'q1', quote_number: 'Q-0047-01', status: 'draft', total: '500', sections: [], versions: [] }, refetch: mockRefetch };
      return { data: null, isLoading: false, refetch: mockRefetch };
    });
    renderJobCard('/jobs/j1/quote');
    expect(screen.getByText(/Quote Builder will be rendered here/)).toBeInTheDocument();
  });

  it('back button navigates to previous page', async () => {
    renderJobCard();
    const backBtn = screen.getAllByRole('button')[0]; // first button is back
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd frontend && npx vitest run src/pages/jobs/job-card/__tests__/JobCard.test.tsx`
Fix any failures.

- [ ] **Step 3: Run full test suite**

Run: `cd frontend && npx vitest run`
All tests must pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(job-card): add 17-case test suite for Job Card"
```

---

## Task 8: Final Verification

- [ ] **Step 1: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Full test suite**

Run: `cd frontend && npx vitest run`

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A && git commit -m "fix(job-card): address verification issues"
```
