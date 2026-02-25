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
  property_id: z.string().optional(),
  contact_type: z.enum(['primary', 'billing', 'site', 'emergency', 'other']),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  job_title: z.string().optional(),
  is_primary: z.boolean(),
  preferred_contact_method: z.enum(['email', 'phone', 'sms', 'any']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: { id: string; customer_id: string; property_id?: string | null; contact_type: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; mobile?: string | null; job_title?: string | null; is_primary: boolean; preferred_contact_method: string; notes?: string | null };
}

export function ContactFormDialog({ open, onOpenChange, contact }: Props) {
  const isEdit = !!contact;
  const { data: customersResult } = useApiList<{ id: string; display_name: string }>(['customers', 'select'], '/v1/customers', { limit: 100, status: 'active' }, { enabled: open });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: '', property_id: '', contact_type: 'other', first_name: '', last_name: '', email: '', phone: '', mobile: '', job_title: '', is_primary: false, preferred_contact_method: 'any', notes: '' },
  });

  useEffect(() => {
    if (contact) {
      reset({ customer_id: contact.customer_id, property_id: contact.property_id ?? '', contact_type: contact.contact_type as FormData['contact_type'], first_name: contact.first_name, last_name: contact.last_name, email: contact.email ?? '', phone: contact.phone ?? '', mobile: contact.mobile ?? '', job_title: contact.job_title ?? '', is_primary: contact.is_primary, preferred_contact_method: contact.preferred_contact_method as FormData['preferred_contact_method'], notes: contact.notes ?? '' });
    } else {
      reset({ customer_id: '', property_id: '', contact_type: 'other', first_name: '', last_name: '', email: '', phone: '', mobile: '', job_title: '', is_primary: false, preferred_contact_method: 'any', notes: '' });
    }
  }, [contact, reset]);

  const createMut = useApiMutation('post', '/v1/contacts', [['contacts']]);
  const updateMut = useApiMutation('put', `/v1/contacts/${contact?.id ?? ''}`, [['contacts'], ['contact', contact?.id]]);
  const mutation = isEdit ? updateMut : createMut;

  const onSubmit = (data: FormData) => {
    const payload = { ...data, email: data.email || null, phone: data.phone || null, mobile: data.mobile || null, job_title: data.job_title || null, property_id: data.property_id || null, notes: data.notes || null };
    mutation.mutate(payload as never, {
      onSuccess: () => { toast.success(isEdit ? 'Contact updated' : 'Contact created'); onOpenChange(false); },
      onError: (err) => { toast.error(err.response?.data?.message ?? 'Something went wrong'); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Contact' : 'New Contact'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Customer" error={errors.customer_id?.message} required>
            <Select value={watch('customer_id')} onValueChange={(v) => setValue('customer_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent>{(customersResult?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={errors.first_name?.message} required><Input {...register('first_name')} /></FormField>
            <FormField label="Last Name" error={errors.last_name?.message} required><Input {...register('last_name')} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type" error={errors.contact_type?.message}>
              <Select value={watch('contact_type')} onValueChange={(v) => setValue('contact_type', v as FormData['contact_type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Preferred Contact" error={errors.preferred_contact_method?.message}>
              <Select value={watch('preferred_contact_method')} onValueChange={(v) => setValue('preferred_contact_method', v as FormData['preferred_contact_method'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input {...register('phone')} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mobile" error={errors.mobile?.message}><Input {...register('mobile')} /></FormField>
            <FormField label="Job Title" error={errors.job_title?.message}><Input {...register('job_title')} /></FormField>
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
