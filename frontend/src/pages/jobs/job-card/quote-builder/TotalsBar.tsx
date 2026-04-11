import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiMutation } from '@/hooks/useApi';

interface TotalsQuote {
  id: string;
  tax_enabled: boolean;
  tax_rate: number;
  discount_amount: number;
}

interface TotalsBarProps {
  quote: TotalsQuote;
  computedSubtotal: number;
}

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

export function TotalsBar({ quote, computedSubtotal }: TotalsBarProps) {
  const [discount, setDiscount] = useState(String(quote.discount_amount || 0));

  const patchQuote = useApiMutation<void, Record<string, unknown>>(
    'patch',
    `/v1/quotes/${quote.id}`,
    [['quote', quote.id]],
  );

  const discountNum = parseFloat(discount) || 0;
  const taxAmount = quote.tax_enabled ? (computedSubtotal - discountNum) * (quote.tax_rate / 100) : 0;
  const total = computedSubtotal - discountNum + taxAmount;

  return (
    <div className="border-t pt-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{fmt(computedSubtotal)}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <Label className="text-muted-foreground">Discount</Label>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">$</span>
          <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} onBlur={() => patchQuote.mutateAsync({ discount_amount: parseFloat(discount) || 0 })} className="h-8 w-24 text-sm text-right" min={0} step="any" />
        </div>
      </div>
      {discountNum > 0 && (
        <div className="flex justify-between text-sm"><span></span><span className="text-green-600">-{fmt(discountNum)}</span></div>
      )}
      {quote.tax_enabled && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax ({quote.tax_rate}%)</span>
          <span>{fmt(taxAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-lg font-bold pt-2 border-t">
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
