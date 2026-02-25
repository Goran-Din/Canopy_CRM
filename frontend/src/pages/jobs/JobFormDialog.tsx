import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { useApiMutation, useApiList } from '@/hooks/useApi';
import { toast } from 'sonner';

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  property_id: z.string().min(1, 'Property is required'),
  contract_id: z.string().optional(),
  division: z.enum(['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal']),
  job_type: z.enum(['scheduled_service', 'one_time', 'emergency', 'inspection', 'estimate']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  scheduled_date: z.string().optional(),
  scheduled_start_time: z.string().optional(),
  estimated_duration_minutes: z.coerce.number().int().min(0).optional().or(z.literal('')),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  assigned_crew_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: { id: string; customer_id: string; property_id: string; contract_id?: string | null; division: string; job_type: string; title: string; description?: string | null; scheduled_date?: string | null; scheduled_start_time?: string | null; estimated_duration_minutes?: number | null; priority: string; assigned_crew_id?: string | null; notes?: string | null };
}

export function JobFormDialog({ open, onOpenChange, job }: Props) {
  const isEdit = !!job;
  const { data: customersResult } = useApiList<{ id: string; display_name: string }>(['customers', 'select'], '/v1/customers', { limit: 100, status: 'active' }, { enabled: open });
  const { data: propertiesResult } = useApiList<{ id: string; property_name: string | null; address_line1: string | null }>(['properties', 'select'], '/v1/properties', { limit: 100 }, { enabled: open });
  const { data: crewsResult } = useApiList<{ id: string; crew_name: string }>(['crews', 'select'], '/v1/crews', { limit: 100, status: 'active' }, { enabled: open });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: '', property_id: '', contract_id: '', division: 'landscaping_maintenance', job_type: 'scheduled_service', title: '', description: '', scheduled_date: '', scheduled_start_time: '', estimated_duration_minutes: '', priority: 'normal', assigned_crew_id: '', notes: '' },
  });

  useEffect(() => {
    if (job) {
      reset({ customer_id: job.customer_id, property_id: job.property_id, contract_id: job.contract_id ?? '', division: job.division as FormData['division'], job_type: job.job_type as FormData['job_type'], title: job.title, description: job.description ?? '', scheduled_date: job.scheduled_date?.split('T')[0] ?? '', scheduled_start_time: job.scheduled_start_time ?? '', estimated_duration_minutes: job.estimated_duration_minutes ?? '', priority: job.priority as FormData['priority'], assigned_crew_id: job.assigned_crew_id ?? '', notes: job.notes ?? '' });
    } else {
      reset({ customer_id: '', property_id: '', contract_id: '', division: 'landscaping_maintenance', job_type: 'scheduled_service', title: '', description: '', scheduled_date: '', scheduled_start_time: '', estimated_duration_minutes: '', priority: 'normal', assigned_crew_id: '', notes: '' });
    }
  }, [job, reset]);

  const createMut = useApiMutation('post', '/v1/jobs', [['jobs']]);
  const updateMut = useApiMutation('put', `/v1/jobs/${job?.id ?? ''}`, [['jobs'], ['job', job?.id]]);
  const mutation = isEdit ? updateMut : createMut;

  const onSubmit = (data: FormData) => {
    const payload = { ...data, contract_id: data.contract_id || null, description: data.description || null, scheduled_date: data.scheduled_date || null, scheduled_start_time: data.scheduled_start_time || null, estimated_duration_minutes: data.estimated_duration_minutes === '' ? null : Number(data.estimated_duration_minutes), assigned_crew_id: data.assigned_crew_id || null, notes: data.notes || null };
    mutation.mutate(payload as never, {
      onSuccess: () => { toast.success(isEdit ? 'Job updated' : 'Job created'); onOpenChange(false); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Something went wrong'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Job' : 'New Job'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer" error={errors.customer_id?.message} required>
              <Select value={watch('customer_id')} onValueChange={(v) => setValue('customer_id', v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(customersResult?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent></Select>
            </FormField>
            <FormField label="Property" error={errors.property_id?.message} required>
              <Select value={watch('property_id')} onValueChange={(v) => setValue('property_id', v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(propertiesResult?.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.property_name ?? p.address_line1 ?? p.id}</SelectItem>)}</SelectContent></Select>
            </FormField>
          </div>
          <FormField label="Title" error={errors.title?.message} required><Input {...register('title')} /></FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Type" error={errors.job_type?.message}>
              <Select value={watch('job_type')} onValueChange={(v) => setValue('job_type', v as FormData['job_type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled_service">Scheduled</SelectItem><SelectItem value="one_time">One Time</SelectItem><SelectItem value="emergency">Emergency</SelectItem><SelectItem value="inspection">Inspection</SelectItem><SelectItem value="estimate">Estimate</SelectItem></SelectContent></Select>
            </FormField>
            <FormField label="Division" error={errors.division?.message}>
              <Select value={watch('division')} onValueChange={(v) => setValue('division', v as FormData['division'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="landscaping_maintenance">Maintenance</SelectItem><SelectItem value="landscaping_projects">Projects</SelectItem><SelectItem value="hardscape">Hardscape</SelectItem><SelectItem value="snow_removal">Snow</SelectItem></SelectContent></Select>
            </FormField>
            <FormField label="Priority" error={errors.priority?.message}>
              <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v as FormData['priority'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Date" error={errors.scheduled_date?.message}><Input type="date" {...register('scheduled_date')} /></FormField>
            <FormField label="Start Time" error={errors.scheduled_start_time?.message}><Input type="time" {...register('scheduled_start_time')} /></FormField>
            <FormField label="Duration (min)" error={errors.estimated_duration_minutes?.message}><Input type="number" {...register('estimated_duration_minutes')} /></FormField>
          </div>
          <FormField label="Crew" error={errors.assigned_crew_id?.message}>
            <Select value={watch('assigned_crew_id') ?? ''} onValueChange={(v) => setValue('assigned_crew_id', v)}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent>{(crewsResult?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.crew_name}</SelectItem>)}</SelectContent></Select>
          </FormField>
          <FormField label="Description" error={errors.description?.message}><textarea {...register('description')} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
