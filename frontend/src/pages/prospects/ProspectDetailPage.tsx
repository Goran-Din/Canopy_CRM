import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Prospect {
  id: string; first_name: string | null; last_name: string | null; company_name: string | null;
  email: string | null; phone: string | null; mobile: string | null; status: string; source: string | null;
  estimated_value: string | null; interest_services: string[]; address_line1: string | null;
  city: string | null; state: string | null; zip: string | null; notes: string | null;
  next_follow_up_date: string | null; last_contacted_at: string | null; created_at: string;
}

function fmt(v: string | null): string { if (!v) return '-'; return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v)); }

const statusFlow = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'];

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: prospect, isLoading } = useApiGet<Prospect>(['prospect', id], `/v1/prospects/${id}`, undefined, { enabled: !!id });
  const statusMut = useApiMutation('put', `/v1/prospects/${id}/status`, [['prospects'], ['prospect', id]]);
  const convertMut = useApiMutation('post', `/v1/prospects/${id}/convert`, [['prospects'], ['prospect', id], ['customers']]);

  const changeStatus = (status: string) => {
    statusMut.mutate({ status } as never, { onSuccess: () => toast.success(`Status: ${status.replace(/_/g, ' ')}`), onError: (err) => toast.error(err.response?.data?.message ?? 'Failed') });
  };

  const convertToCustomer = () => {
    convertMut.mutate({} as never, {
      onSuccess: () => { toast.success('Converted to customer'); navigate('/customers'); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Conversion failed'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!prospect) return <div className="text-center py-12"><p className="text-muted-foreground">Prospect not found</p></div>;

  const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || prospect.company_name || 'Unknown';
  const currentIdx = statusFlow.indexOf(prospect.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/prospects')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={name} description={prospect.company_name ?? undefined} actions={
          prospect.status === 'won' ? <Button onClick={convertToCustomer} disabled={convertMut.isPending}><UserPlus className="mr-2 h-4 w-4" />Convert to Customer</Button> : undefined
        } />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Details</CardTitle><StatusBadge status={prospect.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {prospect.email && <div><p className="text-xs text-muted-foreground">Email</p><p>{prospect.email}</p></div>}
            {prospect.phone && <div><p className="text-xs text-muted-foreground">Phone</p><p>{prospect.phone}</p></div>}
            {prospect.mobile && <div><p className="text-xs text-muted-foreground">Mobile</p><p>{prospect.mobile}</p></div>}
            {prospect.source && <div><p className="text-xs text-muted-foreground">Source</p><p className="capitalize">{prospect.source.replace(/_/g, ' ')}</p></div>}
            <div><p className="text-xs text-muted-foreground">Estimated Value</p><p>{fmt(prospect.estimated_value)}</p></div>
            {prospect.next_follow_up_date && <div><p className="text-xs text-muted-foreground">Next Follow-up</p><p>{new Date(prospect.next_follow_up_date).toLocaleDateString()}</p></div>}
            {prospect.last_contacted_at && <div><p className="text-xs text-muted-foreground">Last Contacted</p><p>{new Date(prospect.last_contacted_at).toLocaleDateString()}</p></div>}
            {prospect.address_line1 && <div><p className="text-xs text-muted-foreground">Address</p><p>{[prospect.address_line1, prospect.city, prospect.state, prospect.zip].filter(Boolean).join(', ')}</p></div>}
            {prospect.interest_services?.length > 0 && <div><p className="text-xs text-muted-foreground">Interested In</p><div className="flex flex-wrap gap-1 mt-1">{prospect.interest_services.map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}</span>)}</div></div>}
            {prospect.notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="whitespace-pre-wrap">{prospect.notes}</p></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Status Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statusFlow.map((s, i) => (
                <div key={s} className={`flex items-center gap-3 rounded-md p-2 ${s === prospect.status ? 'bg-primary/10 border border-primary' : i < currentIdx ? 'bg-muted/50' : ''}`}>
                  <div className={`h-3 w-3 rounded-full ${s === prospect.status ? 'bg-primary' : i < currentIdx ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <span className={`text-sm capitalize ${s === prospect.status ? 'font-medium' : ''}`}>{s.replace(/_/g, ' ')}</span>
                  {s !== prospect.status && Math.abs(i - currentIdx) === 1 && !['won', 'lost'].includes(prospect.status) && (
                    <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => changeStatus(s)} disabled={statusMut.isPending}>Move here</Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
