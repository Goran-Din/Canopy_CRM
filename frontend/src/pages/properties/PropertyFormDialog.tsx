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
import { useApiMutation, useApiList } from '@/hooks/useApi';
import { US_STATES } from '@/lib/us-states';
import { toast } from 'sonner';

const propertyFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  property_name: z.string().optional(),
  property_type: z.enum(['residential', 'commercial', 'hoa', 'municipal', 'other']),
  status: z.enum(['active', 'inactive', 'pending', 'archived']),
  service_frequency: z.enum(['weekly', 'biweekly', 'monthly', 'per_visit', 'seasonal', 'on_demand']),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  lot_size_sqft: z.coerce.number().int().min(0).optional().or(z.literal('')),
  lawn_area_sqft: z.coerce.number().int().min(0).optional().or(z.literal('')),
  zone: z.string().optional(),
  notes: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: {
    id: string;
    customer_id: string;
    property_name?: string | null;
    property_type: string;
    status: string;
    service_frequency: string;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    lot_size_sqft?: number | null;
    lawn_area_sqft?: number | null;
    zone?: string | null;
    notes?: string | null;
  };
}

interface CustomerOption {
  id: string;
  display_name: string;
}

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
}: PropertyFormDialogProps) {
  const isEdit = !!property;

  const { data: customersResult } = useApiList<CustomerOption>(
    ['customers', 'select'],
    '/v1/customers',
    { limit: 100 },
    { enabled: open },
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      customer_id: '',
      property_name: '',
      property_type: 'residential',
      status: 'pending',
      service_frequency: 'weekly',
      address_line1: '',
      address_line2: '',
      city: '',
      state: 'IL',
      zip: '',
      lot_size_sqft: '',
      lawn_area_sqft: '',
      zone: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (property) {
      reset({
        customer_id: property.customer_id,
        property_name: property.property_name ?? '',
        property_type: property.property_type as PropertyFormData['property_type'],
        status: property.status as PropertyFormData['status'],
        service_frequency: property.service_frequency as PropertyFormData['service_frequency'],
        address_line1: property.address_line1 ?? '',
        address_line2: property.address_line2 ?? '',
        city: property.city ?? '',
        state: property.state ?? '',
        zip: property.zip ?? '',
        lot_size_sqft: property.lot_size_sqft ?? '',
        lawn_area_sqft: property.lawn_area_sqft ?? '',
        zone: property.zone ?? '',
        notes: property.notes ?? '',
      });
    } else {
      reset({
        customer_id: '',
        property_name: '',
        property_type: 'residential',
        status: 'pending',
        service_frequency: 'weekly',
        address_line1: '',
        address_line2: '',
        city: '',
        state: 'IL',
        zip: '',
        lot_size_sqft: '',
        lawn_area_sqft: '',
        zone: '',
        notes: '',
      });
    }
  }, [property, reset]);

  const createMutation = useApiMutation('post', '/v1/properties', [['properties']]);
  const updateMutation = useApiMutation(
    'put',
    `/v1/properties/${property?.id ?? ''}`,
    [['properties'], ['property', property?.id]],
  );

  const mutation = isEdit ? updateMutation : createMutation;

  const onSubmit = (data: PropertyFormData) => {
    const payload = {
      ...data,
      property_name: data.property_name || null,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      lot_size_sqft: data.lot_size_sqft === '' ? null : Number(data.lot_size_sqft),
      lawn_area_sqft: data.lawn_area_sqft === '' ? null : Number(data.lawn_area_sqft),
      zone: data.zone || null,
      notes: data.notes || null,
    };

    mutation.mutate(payload as unknown, {
      onSuccess: () => {
        toast.success(isEdit ? 'Property updated' : 'Property created');
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
          <DialogTitle>{isEdit ? 'Edit Property' : 'New Property'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Customer" htmlFor="customer_id" error={errors.customer_id?.message} required>
            <Select
              value={watch('customer_id')}
              onValueChange={(v) => setValue('customer_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {(customersResult?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Property Name" htmlFor="property_name" error={errors.property_name?.message}>
            <Input {...register('property_name')} placeholder="e.g., Main Residence" />
          </FormField>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Type" htmlFor="property_type" error={errors.property_type?.message}>
              <Select
                value={watch('property_type')}
                onValueChange={(v) => setValue('property_type', v as PropertyFormData['property_type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="hoa">HOA</SelectItem>
                  <SelectItem value="municipal">Municipal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Status" htmlFor="status" error={errors.status?.message}>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as PropertyFormData['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Frequency" htmlFor="service_frequency" error={errors.service_frequency?.message}>
              <Select
                value={watch('service_frequency')}
                onValueChange={(v) => setValue('service_frequency', v as PropertyFormData['service_frequency'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="per_visit">Per Visit</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="on_demand">On Demand</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Address" htmlFor="address_line1" error={errors.address_line1?.message}>
            <Input {...register('address_line1')} placeholder="Street address" />
          </FormField>

          <FormField label="Address Line 2" htmlFor="address_line2" error={errors.address_line2?.message}>
            <Input {...register('address_line2')} placeholder="Unit, suite, etc." />
          </FormField>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="City" htmlFor="city" error={errors.city?.message}>
              <Input {...register('city')} />
            </FormField>
            <FormField label="State" htmlFor="state" error={errors.state?.message}>
              <Select
                value={watch('state')}
                onValueChange={(v) => setValue('state', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="ZIP Code" htmlFor="zip" error={errors.zip?.message}>
              <Input {...register('zip')} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Lot Size (sqft)" htmlFor="lot_size_sqft" error={errors.lot_size_sqft?.message}>
              <Input type="number" {...register('lot_size_sqft')} />
            </FormField>
            <FormField label="Lawn Area (sqft)" htmlFor="lawn_area_sqft" error={errors.lawn_area_sqft?.message}>
              <Input type="number" {...register('lawn_area_sqft')} />
            </FormField>
            <FormField label="Zone" htmlFor="zone" error={errors.zone?.message}>
              <Input {...register('zone')} placeholder="e.g., Zone A" />
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
