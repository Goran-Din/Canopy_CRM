import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Camera, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Step { id: string; title: string; description: string | null; estimated_minutes: number | null; requires_photo: boolean; requires_signature: boolean; sort_order: number }
interface Template {
  id: string; title: string; description: string | null; category: string; division: string | null;
  status: string; version: number; steps: Step[]; created_at: string;
}

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: template, isLoading } = useApiGet<Template>(['sop-template', id], `/v1/sops/templates/${id}`, undefined, { enabled: !!id });
  const duplicateMut = useApiMutation('post', `/v1/sops/templates/${id}/duplicate`, [['sop-templates']]);
  const statusMut = useApiMutation('put', `/v1/sops/templates/${id}`, [['sop-template', id], ['sop-templates']]);

  const handleDuplicate = () => {
    duplicateMut.mutate({} as never, {
      onSuccess: () => { toast.success('Template duplicated'); navigate('/sops'); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const changeStatus = (status: string) => {
    statusMut.mutate({ status } as never, { onSuccess: () => toast.success(`Status: ${status}`), onError: (err) => toast.error(err.response?.data?.message ?? 'Failed') });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!template) return <div className="text-center py-12"><p className="text-muted-foreground">Template not found</p></div>;

  const sortedSteps = [...(template.steps ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sops')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={template.title} description={`v${template.version} - ${template.category.replace(/_/g, ' ')}`} actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicateMut.isPending}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>
            {template.status === 'draft' && <Button size="sm" onClick={() => changeStatus('active')}>Activate</Button>}
            {template.status === 'active' && <Button variant="outline" size="sm" onClick={() => changeStatus('archived')}>Archive</Button>}
          </div>
        } />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Info</CardTitle><StatusBadge status={template.status} /></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Category</p><p className="capitalize">{template.category.replace(/_/g, ' ')}</p></div>
            {template.division && <div><p className="text-xs text-muted-foreground">Division</p><p className="capitalize">{template.division.replace(/_/g, ' ')}</p></div>}
            <div><p className="text-xs text-muted-foreground">Version</p><p>{template.version}</p></div>
            <div><p className="text-xs text-muted-foreground">Steps</p><p>{sortedSteps.length}</p></div>
            {template.description && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Description</p><p className="whitespace-pre-wrap">{template.description}</p></div>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Steps ({sortedSteps.length})</CardTitle></CardHeader>
          <CardContent>
            {sortedSteps.length === 0 ? <p className="text-sm text-muted-foreground">No steps defined.</p> : (
              <div className="space-y-2">
                {sortedSteps.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-3 rounded-md border p-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{step.title}</p>
                      {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        {step.estimated_minutes && <span className="text-xs text-muted-foreground">{step.estimated_minutes} min</span>}
                        {step.requires_photo && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Camera className="h-3 w-3" />Photo</span>}
                        {step.requires_signature && <span className="flex items-center gap-1 text-xs text-muted-foreground"><PenTool className="h-3 w-3" />Sign</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
