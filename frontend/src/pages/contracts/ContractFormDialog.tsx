import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { useApiMutation, useApiList } from '@/hooks/useApi';
import { toast } from 'sonner';

const lineItemSchema = z.object({
  service_name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0).default(1),
  unit_price: z.coerce.number().min(0),
  sort_order: z.coerce.number().default(0),
});

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  property_id: z.string().min(1, 'Property is required'),
  contract_type: z.enum(['maintenance', 'landscape_project', 'snow_removal', 'hardscape']),
  division: z.enum(['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  billing_frequency: z.enum(['per_visit', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'project_complete', 'per_event']),
  contract_value: z.coerce.number().min(0).optional(),
  auto_renew: z.boolean(),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: { id: string; customer_id: string; property_id: string; contract_type: string; division: string; title: string; description?: string | null; start_date: string; end_date?: string | null; billing_frequency: string; contract_value?: string | null; auto_renew: boolean; notes?: string | null; line_items?: Array<{ service_name: string; description?: string | null; quantity: number; unit_price: string; sort_order: number }> };
}

export function ContractFormDialog({ open, onOpenChange, contract }: Props) {
  const isEdit = !!contract;
  const { data: customersResult } = useApiList<{ id: string; display_name: string }>(['customers', 'select'], '/v1/customers', { limit: 100, status: 'active' }, { enabled: open });
  const { data: propertiesResult } = useApiList<{ id: string; property_name: string | null; address_line1: string | null }>(['properties', 'select'], '/v1/properties', { limit: 100 }, { enabled: open });

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: '', property_id: '', contract_type: 'maintenance', division: 'landscaping_maintenance', title: '', description: '', start_date: '', end_date: '', billing_frequency: 'monthly', contract_value: undefined, auto_renew: false, notes: '', line_items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });

  useEffect(() => {
    if (contract) {
      reset({
        customer_id: contract.customer_id, property_id: contract.property_id, contract_type: contract.contract_type as FormData['contract_type'],
        division: contract.division as FormData['division'], title: contract.title, description: contract.description ?? '', start_date: contract.start_date?.split('T')[0] ?? '',
        end_date: contract.end_date?.split('T')[0] ?? '', billing_frequency: contract.billing_frequency as FormData['billing_frequency'],
        contract_value: contract.contract_value ? parseFloat(contract.contract_value) : undefined, auto_renew: contract.auto_renew, notes: contract.notes ?? '',
        line_items: (contract.line_items ?? []).map((li) => ({ service_name: li.service_name, description: li.description ?? '', quantity: li.quantity, unit_price: parseFloat(li.unit_price), sort_order: li.sort_order })),
      });
    } else {
      reset({ customer_id: '', property_id: '', contract_type: 'maintenance', division: 'landscaping_maintenance', title: '', description: '', start_date: '', end_date: '', billing_frequency: 'monthly', contract_value: undefined, auto_renew: false, notes: '', line_items: [] });
    }
  }, [contract, reset]);

  const createMut = useApiMutation('post', '/v1/contracts', [['contracts']]);
  const updateMut = useApiMutation('put', `/v1/contracts/${contract?.id ?? ''}`, [['contracts'], ['contract', contract?.id]]);
  const mutation = isEdit ? updateMut : createMut;

  const onSubmit = (data: FormData) => {
    const payload = { ...data, description: data.description || null, end_date: data.end_date || null, notes: data.notes || null, contract_value: data.contract_value || null };
    mutation.mutate(payload as never, {
      onSuccess: () => { toast.success(isEdit ? 'Contract updated' : 'Contract created'); onOpenChange(false); },
      onError: (err) => { toast.error(err.response?.data?.message ?? 'Something went wrong'); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Contract' : 'New Contract'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer" error={errors.customer_id?.message} required>
              <Select value={watch('customer_id')} onValueChange={(v) => setValue('customer_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{(customersResult?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Property" error={errors.property_id?.message} required>
              <Select value={watch('property_id')} onValueChange={(v) => setValue('property_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{(propertiesResult?.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.property_name ?? p.address_line1 ?? p.id}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Title" error={errors.title?.message} required><Input {...register('title')} /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type" error={errors.contract_type?.message}>
              <Select value={watch('contract_type')} onValueChange={(v) => setValue('contract_type', v as FormData['contract_type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="landscape_project">Landscape Project</SelectItem>
                  <SelectItem value="snow_removal">Snow Removal</SelectItem>
                  <SelectItem value="hardscape">Hardscape</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Division" error={errors.division?.message}>
              <Select value={watch('division')} onValueChange={(v) => setValue('division', v as FormData['division'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscaping_maintenance">Maintenance</SelectItem>
                  <SelectItem value="landscaping_projects">Projects</SelectItem>
                  <SelectItem value="hardscape">Hardscape</SelectItem>
                  <SelectItem value="snow_removal">Snow</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Start Date" error={errors.start_date?.message} required><Input type="date" {...register('start_date')} /></FormField>
            <FormField label="End Date" error={errors.end_date?.message}><Input type="date" {...register('end_date')} /></FormField>
            <FormField label="Billing Frequency" error={errors.billing_frequency?.message}>
              <Select value={watch('billing_frequency')} onValueChange={(v) => setValue('billing_frequency', v as FormData['billing_frequency'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                  <SelectItem value="per_visit">Per Visit</SelectItem>
                  <SelectItem value="per_event">Per Event</SelectItem>
                  <SelectItem value="project_complete">Project Complete</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Contract Value" error={errors.contract_value?.message}><Input type="number" step="0.01" {...register('contract_value')} /></FormField>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Line Items</p>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ service_name: '', description: '', quantity: 1, unit_price: 0, sort_order: fields.length })}>
                <Plus className="mr-1 h-3 w-3" />Add Item
              </Button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-start gap-2 rounded-md border p-3">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div className="col-span-2"><Input placeholder="Service" {...register(`line_items.${idx}.service_name`)} className="text-sm" /></div>
                  <Input type="number" placeholder="Qty" {...register(`line_items.${idx}.quantity`)} className="text-sm" />
                  <Input type="number" step="0.01" placeholder="Price" {...register(`line_items.${idx}.unit_price`)} className="text-sm" />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
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
