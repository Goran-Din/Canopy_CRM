import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

interface Section {
  id: string;
  title: string;
  body?: string;
  sort_order: number;
  line_items: LineItem[];
}

export interface QuoteData {
  quote_number: string;
  valid_until: string;
  customer_name: string;
  property_address: string;
  sections: Section[];
  subtotal: number;
  discount_amount: number;
  total: number;
  client_notes?: string;
  payment_terms?: string;
  company_phone?: string;
  company_email?: string;
}

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '$0.00';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

interface QuoteSummaryProps {
  quote: QuoteData;
}

export function QuoteSummary({ quote }: QuoteSummaryProps) {
  const sortedSections = [...quote.sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Quote {quote.quote_number}</CardTitle>
        <p className="text-sm text-muted-foreground">Valid until: {quote.valid_until}</p>
        <div className="pt-2 space-y-1">
          <p className="text-sm"><span className="text-muted-foreground">Prepared for:</span> {quote.customer_name}</p>
          <p className="text-sm"><span className="text-muted-foreground">Property:</span> {quote.property_address}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sections with line items */}
        {sortedSections.map((section) => {
          const sortedItems = [...section.line_items].sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={section.id} className="space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              {section.body && (
                <p className="text-sm text-muted-foreground">{section.body}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Item</th>
                      <th className="text-right py-2 font-medium">Qty</th>
                      <th className="text-right py-2 font-medium">Price</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{fmt(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium">{fmt(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div className="border-t pt-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{fmt(quote.subtotal)}</span>
          </div>
          {quote.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-green-600">-{fmt(quote.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>Total</span>
            <span>{fmt(quote.total)}</span>
          </div>
        </div>

        {/* Notes & terms */}
        {quote.client_notes && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">{quote.client_notes}</p>
          </div>
        )}
        {quote.payment_terms && (
          <div className="pt-1">
            <p className="text-sm text-muted-foreground">{quote.payment_terms}</p>
          </div>
        )}

        {/* Contact info */}
        {(quote.company_phone || quote.company_email) && (
          <div className="border-t pt-4 text-sm text-muted-foreground text-center space-y-1">
            {quote.company_phone && <p>Questions? Call {quote.company_phone}</p>}
            {quote.company_email && <p>or email {quote.company_email}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
