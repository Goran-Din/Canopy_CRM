import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

const customerFormSchema = z
  .object({
    customer_type: z.enum(['residential', 'commercial']),
    status: z.enum(['active', 'inactive', 'suspended', 'prospect', 'archived']),
    source: z.enum(['referral', 'website', 'mautic', 'manual', 'other']),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    company_name: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    billing_address_line1: z.string().optional(),
    billing_city: z.string().optional(),
    billing_state: z.string().optional(),
    billing_zip: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      data.customer_type !== 'commercial' ||
      (data.company_name && data.company_name.trim().length > 0),
    { message: 'Company name is required for commercial customers', path: ['company_name'] },
  );

type CustomerFormData = z.infer<typeof customerFormSchema>;

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: {
    id: string;
    customer_type: string;
    status: string;
    source: string;
    first_name: string;
    last_name: string;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    billing_address_line1?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_zip?: string | null;
    notes?: string | null;
  };
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: CustomerFormDialogProps) {
  const isEdit = !!customer;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      customer_type: 'residential',
      status: 'prospect',
      source: 'manual',
      first_name: '',
      last_name: '',
      company_name: '',
      email: '',
      phone: '',
      mobile: '',
      billing_address_line1: '',
      billing_city: '',
      billing_state: '',
      billing_zip: '',
      notes: '',
    },
  });

  const customerType = watch('customer_type');

  useEffect(() => {
    if (customer) {
      reset({
        customer_type: customer.customer_type as 'residential' | 'commercial',
        status: customer.status as CustomerFormData['status'],
        source: customer.source as CustomerFormData['source'],
        first_name: customer.first_name,
        last_name: customer.last_name,
        company_name: customer.company_name ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        mobile: customer.mobile ?? '',
        billing_address_line1: customer.billing_address_line1 ?? '',
        billing_city: customer.billing_city ?? '',
        billing_state: customer.billing_state ?? '',
        billing_zip: customer.billing_zip ?? '',
        notes: customer.notes ?? '',
      });
    } else {
      reset({
        customer_type: 'residential',
        status: 'prospect',
        source: 'manual',
        first_name: '',
        last_name: '',
        company_name: '',
        email: '',
        phone: '',
        mobile: '',
        billing_address_line1: '',
        billing_city: '',
        billing_state: '',
        billing_zip: '',
        notes: '',
      });
    }
  }, [customer, reset]);

  const createMutation = useApiMutation('post', '/v1/customers', [['customers']]);
  const updateMutation = useApiMutation(
    'put',
    `/v1/customers/${customer?.id ?? ''}`,
    [['customers'], ['customer', customer?.id]],
  );

  const mutation = isEdit ? updateMutation : createMutation;

  const onSubmit = (data: CustomerFormData) => {
    const payload = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      company_name: data.company_name || null,
      billing_address_line1: data.billing_address_line1 || null,
      billing_city: data.billing_city || null,
      billing_state: data.billing_state || null,
      billing_zip: data.billing_zip || null,
      notes: data.notes || null,
    };

    mutation.mutate(payload as unknown, {
      onSuccess: () => {
        toast.success(isEdit ? 'Customer updated' : 'Customer created');
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message ?? 'Something went wrong');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type" htmlFor="customer_type" error={errors.customer_type?.message}>
              <Select
                value={customerType}
                onValueChange={(v) => setValue('customer_type', v as 'residential' | 'commercial')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Status" htmlFor="status" error={errors.status?.message}>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as CustomerFormData['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {customerType === 'commercial' && (
            <FormField
              label="Company Name"
              htmlFor="company_name"
              error={errors.company_name?.message}
              required
            >
              <Input {...register('company_name')} />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" htmlFor="first_name" error={errors.first_name?.message} required>
              <Input {...register('first_name')} />
            </FormField>
            <FormField label="Last Name" htmlFor="last_name" error={errors.last_name?.message} required>
              <Input {...register('last_name')} />
            </FormField>
          </div>

          <FormField label="Source" htmlFor="source" error={errors.source?.message}>
            <Select
              value={watch('source')}
              onValueChange={(v) => setValue('source', v as CustomerFormData['source'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="mautic">Mautic</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </FormField>
            <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input {...register('phone')} />
            </FormField>
          </div>

          <FormField label="Mobile" htmlFor="mobile" error={errors.mobile?.message}>
            <Input {...register('mobile')} />
          </FormField>

          <FormField label="Address" htmlFor="billing_address_line1" error={errors.billing_address_line1?.message}>
            <Input {...register('billing_address_line1')} placeholder="Street address" />
          </FormField>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="City" htmlFor="billing_city" error={errors.billing_city?.message}>
              <Input {...register('billing_city')} />
            </FormField>
            <FormField label="Province" htmlFor="billing_state" error={errors.billing_state?.message}>
              <Input {...register('billing_state')} />
            </FormField>
            <FormField label="Postal Code" htmlFor="billing_zip" error={errors.billing_zip?.message}>
              <Input {...register('billing_zip')} />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <textarea
              {...register('notes')}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
