import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiMutation } from '@/hooks/useApi';
import { XeroItemSearch } from './XeroItemSearch';

export interface QuoteLineItem {
  id: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  line_total: number;
  sort_order: number;
  xero_item_code: string | null;
  xero_default_price: number | null;
}

interface LineItemRowProps {
  item: QuoteLineItem;
  quoteId: string;
  sectionId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

export function LineItemRow({ item, quoteId, sectionId, onUpdate, onDelete }: LineItemRowProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit || 'ea');
  const [unitPrice, setUnitPrice] = useState(item.unit_price != null ? String(item.unit_price) : '');
  const [description, setDescription] = useState(item.description || '');
  const [xeroCode, setXeroCode] = useState(item.xero_item_code);
  const [xeroPrice, setXeroPrice] = useState(item.xero_default_price);

  const patchItem = useApiMutation<void, Record<string, unknown>>(
    'patch',
    `/v1/quotes/${quoteId}/sections/${sectionId}/items/${item.id}`,
    [['quote', quoteId]],
  );

  const deleteItem = useApiMutation<void, void>(
    'delete',
    `/v1/quotes/${quoteId}/sections/${sectionId}/items/${item.id}`,
    [['quote', quoteId]],
  );

  const saveField = async (field: string, value: unknown) => {
    await patchItem.mutateAsync({ [field]: value });
    onUpdate();
  };

  const computedTotal = (parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0);

  const handleXeroSelect = async (selected: { item_name: string; description: string; xero_item_code: string; xero_default_price: number | null }) => {
    setXeroCode(selected.xero_item_code);
    setXeroPrice(selected.xero_default_price);
    setDescription(selected.description);
    await patchItem.mutateAsync({
      item_name: selected.item_name,
      description: selected.description,
      xero_item_code: selected.xero_item_code,
      xero_default_price: selected.xero_default_price,
    });
    onUpdate();
  };

  const handleCustomItem = async (name: string) => {
    setXeroCode(null);
    setXeroPrice(null);
    await patchItem.mutateAsync({ item_name: name, xero_item_code: null, xero_default_price: null });
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteItem.mutateAsync(undefined as never);
    onDelete();
  };

  return (
    <>
      <tr className="border-b last:border-0 align-top">
        <td className="py-2 px-1 w-48">
          <XeroItemSearch value={item.item_name} xeroItemCode={xeroCode} xeroDefaultPrice={xeroPrice} onSelect={handleXeroSelect} onCustom={handleCustomItem} />
        </td>
        <td className="py-2 px-1">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => saveField('description', description)} placeholder="Description" className="min-h-[32px] h-8 text-sm resize-none" />
        </td>
        <td className="py-2 px-1 w-16">
          <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} onBlur={() => saveField('quantity', parseFloat(qty) || 1)} className="h-8 text-sm text-center" min={0} step="any" />
        </td>
        <td className="py-2 px-1 w-16">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} onBlur={() => saveField('unit', unit)} className="h-8 text-sm text-center" />
        </td>
        <td className="py-2 px-1 w-24">
          <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} onBlur={() => saveField('unit_price', unitPrice ? parseFloat(unitPrice) : null)} placeholder="Enter price" className="h-8 text-sm text-right" min={0} step="any" />
        </td>
        <td className="py-2 px-1 w-24 text-right text-sm font-medium">{fmt(computedTotal)}</td>
        <td className="py-2 px-1 w-8">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (item.unit_price != null) { setShowConfirm(true); } else { handleDelete(); } }}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </td>
      </tr>
      <ConfirmDialog open={showConfirm} onOpenChange={setShowConfirm} title="Delete line item?" description={`Remove "${item.item_name || 'this item'}" from the quote?`} onConfirm={() => { setShowConfirm(false); handleDelete(); }} variant="destructive" />
    </>
  );
}
