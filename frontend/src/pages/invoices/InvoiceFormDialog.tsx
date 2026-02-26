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

const lineItemSchema = z.object({ description: z.string().min(1, 'Required'), quantity: z.coerce.number().min(0).default(1), unit_price: z.coerce.number(), tax_rate: z.coerce.number().min(0).default(0), sort_order: z.coerce.number().default(0) });
const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  property_id: z.string().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().min(0).default(0),
  discount_amount: z.coerce.number().min(0).default(0),
  division: z.string().optional(),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema),
});
type FormData = z.infer<typeof schema>;

interface Props { open: boolean; onOpenChange: (open: boolean) => void; invoice?: { id: string; customer_id: string; property_id?: string | null; invoice_date: string; due_date: string; tax_rate: string; discount_amount: string; division?: string | null; notes?: string | null; line_items?: Array<{ description: string; quantity: number; unit_price: string; tax_rate: string; sort_order: number }> } }

export function InvoiceFormDialog({ open, onOpenChange, invoice }: Props) {
  const isEdit = !!invoice;
  const { data: customersResult } = useApiList<{ id: string; display_name: string }>(['customers', 'select'], '/v1/customers', { limit: 100 }, { enabled: open });

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: '', property_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: 13, discount_amount: 0, division: '', notes: '', line_items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });

  useEffect(() => {
    if (invoice) {
      reset({ customer_id: invoice.customer_id, property_id: invoice.property_id ?? '', invoice_date: invoice.invoice_date?.split('T')[0] ?? '', due_date: invoice.due_date?.split('T')[0] ?? '', tax_rate: parseFloat(invoice.tax_rate), discount_amount: parseFloat(invoice.discount_amount), division: invoice.division ?? '', notes: invoice.notes ?? '', line_items: (invoice.line_items ?? []).map((li) => ({ description: li.description, quantity: li.quantity, unit_price: parseFloat(li.unit_price), tax_rate: parseFloat(li.tax_rate), sort_order: li.sort_order })) });
    } else {
      reset({ customer_id: '', property_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: 13, discount_amount: 0, division: '', notes: '', line_items: [] });
    }
  }, [invoice, reset]);

  const createMut = useApiMutation('post', '/v1/invoices', [['invoices']]);
  const updateMut = useApiMutation('put', `/v1/invoices/${invoice?.id ?? ''}`, [['invoices'], ['invoice', invoice?.id]]);
  const mutation = isEdit ? updateMut : createMut;

  const onSubmit = (data: FormData) => {
    const payload = { ...data, property_id: data.property_id || null, division: data.division || null, notes: data.notes || null, due_date: data.due_date || null };
    mutation.mutate(payload as never, {
      onSuccess: () => { toast.success(isEdit ? 'Invoice updated' : 'Invoice created'); onOpenChange(false); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Something went wrong'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Invoice' : 'New Invoice'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Customer" error={errors.customer_id?.message} required>
            <Select value={watch('customer_id')} onValueChange={(v) => setValue('customer_id', v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(customersResult?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent></Select>
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Invoice Date" error={errors.invoice_date?.message}><Input type="date" {...register('invoice_date')} /></FormField>
            <FormField label="Due Date" error={errors.due_date?.message}><Input type="date" {...register('due_date')} /></FormField>
            <FormField label="Tax Rate %" error={errors.tax_rate?.message}><Input type="number" step="0.01" {...register('tax_rate')} /></FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Line Items</p><Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, sort_order: fields.length })}><Plus className="mr-1 h-3 w-3" />Add Item</Button></div>
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-start gap-2 rounded-md border p-3">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="col-span-1"><Input placeholder="Description" {...register(`line_items.${idx}.description`)} className="text-sm" /></div>
                  <Input type="number" placeholder="Qty" {...register(`line_items.${idx}.quantity`)} className="text-sm" />
                  <Input type="number" step="0.01" placeholder="Price" {...register(`line_items.${idx}.unit_price`)} className="text-sm" />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>

          <FormField label="Notes" error={errors.notes?.message}><textarea {...register('notes')} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" /></FormField>
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
