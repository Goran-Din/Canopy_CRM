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
  first_name: z.string().min(1, 'Name is required'),
  last_name: z.string().optional(),
  company_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.enum(['referral', 'website', 'cold_call', 'other', 'mautic', 'trade_show']),
  estimated_value: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  next_follow_up_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect?: {
    id: string; first_name: string | null; last_name: string | null; company_name: string | null;
    email: string | null; phone: string | null; source: string | null;
    estimated_value: string | null; notes: string | null; next_follow_up_date: string | null;
  };
}

export function ProspectFormDialog({ open, onOpenChange, prospect }: Props) {
  const isEdit = !!prospect;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', company_name: '', email: '', phone: '',
      source: 'referral', estimated_value: '', notes: '', next_follow_up_date: '',
    },
  });

  useEffect(() => {
    if (prospect) {
      reset({
        first_name: prospect.first_name ?? '',
        last_name: prospect.last_name ?? '',
        company_name: prospect.company_name ?? '',
        email: prospect.email ?? '',
        phone: prospect.phone ?? '',
        source: (prospect.source as FormData['source']) ?? 'referral',
        estimated_value: prospect.estimated_value ? parseFloat(prospect.estimated_value) : '',
        notes: prospect.notes ?? '',
        next_follow_up_date: prospect.next_follow_up_date?.split('T')[0] ?? '',
      });
    } else {
      reset({
        first_name: '', last_name: '', company_name: '', email: '', phone: '',
        source: 'referral', estimated_value: '', notes: '', next_follow_up_date: '',
      });
    }
  }, [prospect, reset]);

  const createMut = useApiMutation('post', '/v1/prospects', [['prospects']]);
  const updateMut = useApiMutation('put', `/v1/prospects/${prospect?.id ?? ''}`, [['prospects'], ['prospect', prospect?.id]]);
  const mutation = isEdit ? updateMut : createMut;

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      last_name: data.last_name || null,
      company_name: data.company_name || null,
      email: data.email || null,
      phone: data.phone || null,
      estimated_value: data.estimated_value === '' ? null : Number(data.estimated_value),
      notes: data.notes || null,
      next_follow_up_date: data.next_follow_up_date || null,
    };
    mutation.mutate(payload as never, {
      onSuccess: () => { toast.success(isEdit ? 'Prospect updated' : 'Prospect created'); onOpenChange(false); },
      onError: (err) => { toast.error(err.response?.data?.message ?? 'Something went wrong'); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Prospect' : 'New Prospect'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={errors.first_name?.message} required>
              <Input {...register('first_name')} />
            </FormField>
            <FormField label="Last Name" error={errors.last_name?.message}>
              <Input {...register('last_name')} />
            </FormField>
          </div>
          <FormField label="Company" error={errors.company_name?.message}>
            <Input {...register('company_name')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <Input {...register('phone')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Source" error={errors.source?.message}>
              <Select value={watch('source')} onValueChange={(v) => setValue('source', v as FormData['source'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="mautic">Mautic</SelectItem>
                  <SelectItem value="trade_show">Trade Show</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Estimated Value" error={errors.estimated_value?.message}>
              <Input type="number" step="0.01" {...register('estimated_value')} placeholder="$0.00" />
            </FormField>
          </div>
          <FormField label="Follow-up Date" error={errors.next_follow_up_date?.message}>
            <Input type="date" {...register('next_follow_up_date')} />
          </FormField>
          <FormField label="Notes" error={errors.notes?.message}>
            <textarea {...register('notes')} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
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
