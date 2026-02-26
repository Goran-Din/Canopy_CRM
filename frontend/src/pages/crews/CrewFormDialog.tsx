import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

const schema = z.object({
  crew_name: z.string().min(1, 'Crew name is required'),
  division: z.enum(['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal']),
  status: z.enum(['active', 'inactive', 'on_leave', 'seasonal']),
  color_code: z.string().optional(),
  max_jobs_per_day: z.coerce.number().int().min(1).optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crew?: {
    id: string; crew_name: string; division: string; status: string;
    color_code?: string | null; max_jobs_per_day?: number | null; notes?: string | null;
  };
}

export function CrewFormDialog({ open, onOpenChange, crew }: Props) {
  const isEdit = !!crew;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      crew_name: '', division: 'landscaping_maintenance', status: 'active',
      color_code: '', max_jobs_per_day: 12, notes: '',
    },
  });

  useEffect(() => {
    if (crew) {
      reset({
        crew_name: crew.crew_name,
        division: crew.division as FormData['division'],
        status: crew.status as FormData['status'],
        color_code: crew.color_code ?? '',
        max_jobs_per_day: crew.max_jobs_per_day ?? 12,
        notes: crew.notes ?? '',
      });
    } else {
      reset({
        crew_name: '', division: 'landscaping_maintenance', status: 'active',
        color_code: '', max_jobs_per_day: 12, notes: '',
      });
    }
  }, [crew, reset]);

  const createMut = useApiMutation('post', '/v1/crews', [['crews']]);
  const updateMut = useApiMutation('put', `/v1/crews/${crew?.id ?? ''}`, [['crews'], ['crew', crew?.id]]);
  const mutation = isEdit ? updateMut : createMut;

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      color_code: data.color_code || null,
      max_jobs_per_day: data.max_jobs_per_day === '' ? 12 : Number(data.max_jobs_per_day),
      notes: data.notes || null,
    };
    mutation.mutate(payload as never, {
      onSuccess: () => { toast.success(isEdit ? 'Crew updated' : 'Crew created'); onOpenChange(false); },
      onError: (err) => { toast.error(err.response?.data?.message ?? 'Something went wrong'); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Crew' : 'New Crew'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Crew Name" error={errors.crew_name?.message} required>
            <Input {...register('crew_name')} placeholder="e.g., Team Alpha" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Division" error={errors.division?.message}>
              <Select value={watch('division')} onValueChange={(v) => setValue('division', v as FormData['division'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscaping_maintenance">Maintenance</SelectItem>
                  <SelectItem value="landscaping_projects">Projects</SelectItem>
                  <SelectItem value="hardscape">Hardscape</SelectItem>
                  <SelectItem value="snow_removal">Snow Removal</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Status" error={errors.status?.message}>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v as FormData['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Color Code" error={errors.color_code?.message}>
              <Input {...register('color_code')} placeholder="#22C55E" />
            </FormField>
            <FormField label="Max Jobs/Day" error={errors.max_jobs_per_day?.message}>
              <Input type="number" {...register('max_jobs_per_day')} />
            </FormField>
          </div>
          <FormField label="Notes" error={errors.notes?.message}>
            <textarea {...register('notes')} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
