import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Briefcase, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useApiGet, useApiList } from '@/hooks/useApi';
import { CrewMemberDialog } from './CrewMemberDialog';

interface Member { id: string; user_name: string; role_in_crew: string; email: string | null }
interface Job { id: string; title: string; status: string; scheduled_date: string | null; priority: string }
interface Crew {
  id: string; crew_name: string; division: string; status: string; crew_leader_name: string | null;
  color_code: string | null; max_jobs_per_day: number; notes: string | null; members: Member[];
  created_at: string;
}

const memberColumns: Column<Member>[] = [
  { key: 'user_name', header: 'Name', render: (row) => <span className="font-medium">{row.user_name}</span> },
  { key: 'role_in_crew', header: 'Role', render: (row) => <StatusBadge status={row.role_in_crew} /> },
  { key: 'email', header: 'Email', render: (row) => <span className="text-sm">{row.email ?? '-'}</span> },
];

const jobColumns: Column<Job>[] = [
  { key: 'title', header: 'Job', render: (row) => <span className="font-medium">{row.title}</span> },
  { key: 'scheduled_date', header: 'Scheduled', render: (row) => <span className="text-sm">{row.scheduled_date ? new Date(row.scheduled_date).toLocaleDateString() : '-'}</span> },
  { key: 'priority', header: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

export default function CrewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: crew, isLoading } = useApiGet<Crew>(['crew', id], `/v1/crews/${id}`, undefined, { enabled: !!id });
  const { data: jobsResult } = useApiList<Job>(['jobs', 'crew', id], '/v1/jobs', { assigned_crew_id: id, limit: 50 }, { enabled: !!id });

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!crew) return <div className="text-center py-12"><p className="text-muted-foreground">Crew not found</p><Button variant="link" onClick={() => navigate('/crews')}>Back</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crews')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={crew.crew_name} description={crew.division.replace(/_/g, ' ')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={crew.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Division</p><p className="capitalize">{crew.division.replace(/_/g, ' ')}</p></div>
            <div><p className="text-xs text-muted-foreground">Leader</p><p>{crew.crew_leader_name ?? 'Unassigned'}</p></div>
            <div><p className="text-xs text-muted-foreground">Max Jobs/Day</p><p>{crew.max_jobs_per_day}</p></div>
            {crew.color_code && <div><p className="text-xs text-muted-foreground">Color</p><div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border" style={{ backgroundColor: crew.color_code }} /><span>{crew.color_code}</span></div></div>}
            {crew.notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="whitespace-pre-wrap">{crew.notes}</p></div>}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <Tabs defaultValue="members">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="members"><Users className="mr-1 h-3 w-3" />Members ({crew.members?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="jobs"><Briefcase className="mr-1 h-3 w-3" />Jobs ({jobsResult?.data.length ?? 0})</TabsTrigger>
              </TabsList>
              <Button size="sm" onClick={() => setShowAddMember(true)}>
                <Plus className="mr-1 h-3 w-3" />
                Add Member
              </Button>
            </div>
            <TabsContent value="members" className="mt-4"><DataTable columns={memberColumns} data={crew.members ?? []} emptyMessage="No crew members. Click 'Add Member' to assign users." /></TabsContent>
            <TabsContent value="jobs" className="mt-4"><DataTable columns={jobColumns} data={jobsResult?.data ?? []} emptyMessage="No jobs assigned." onRowClick={(row) => navigate(`/jobs/${row.id}`)} /></TabsContent>
          </Tabs>
        </div>
      </div>
      <CrewMemberDialog open={showAddMember} onOpenChange={setShowAddMember} crewId={id!} />
    </div>
  );
}
