import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import QuoteBuilder from '../quote-builder/QuoteBuilder';

interface QuoteVersion {
  id: string;
  version_number: number;
  status: string;
  total: string;
  created_at: string;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  status: string;
  total: string;
  sections: {
    id: string;
    title: string;
    sort_order: number;
    line_items: {
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      sort_order: number;
    }[];
  }[];
  signer_name?: string;
  signed_at?: string;
  versions: QuoteVersion[];
}

interface QuoteTabProps {
  jobId: string;
  quoteId: string | null;
}

function fmt(v: number | string | null): string {
  if (!v) return '$0.00';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

export function QuoteTab({ jobId, quoteId }: QuoteTabProps) {
  const { data: quote, refetch } = useApiGet<QuoteDetail>(
    ['quote', quoteId ?? ''],
    `/v1/quotes/${quoteId}`,
    undefined,
    { enabled: !!quoteId },
  );

  const createQuote = useApiMutation<{ id: string }, void>(
    'post',
    `/v1/jobs/${jobId}/quotes`,
    [['job', jobId]],
  );

  if (!quoteId) {
    return (
      <div className="mt-4 text-center py-12">
        <p className="text-muted-foreground mb-4">No quote created yet.</p>
        <Button
          onClick={async () => {
            try {
              await createQuote.mutateAsync(undefined as never);
              toast.success('Quote created');
              refetch();
            } catch {
              toast.error('Failed to create quote.');
            }
          }}
        >
          Create Quote
        </Button>
      </div>
    );
  }

  if (!quote) return null;

  if (quote.status === 'draft') {
    return (
      <div className="mt-4">
        <QuoteBuilder quoteId={quote.id} jobId={jobId} onSent={refetch} />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{quote.quote_number}</CardTitle>
            <StatusBadge status={quote.status} />
          </div>
          <p className="text-sm text-muted-foreground">Total: {fmt(quote.total)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section) => (
              <div key={section.id}>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">{section.title}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 font-medium">Item</th>
                      <th className="text-right py-1 font-medium">Qty</th>
                      <th className="text-right py-1 font-medium">Price</th>
                      <th className="text-right py-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.line_items
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-1">{item.description}</td>
                          <td className="text-right py-1">{item.quantity}</td>
                          <td className="text-right py-1">{fmt(item.unit_price)}</td>
                          <td className="text-right py-1 font-medium">{fmt(item.line_total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}

          {quote.signer_name && (
            <div className="border-t pt-3">
              <p className="text-sm"><span className="text-muted-foreground">Signed by:</span> {quote.signer_name}</p>
              {quote.signed_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(quote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {quote.versions && quote.versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quote.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm">Version {v.version_number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{fmt(v.total)}</span>
                    <StatusBadge status={v.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
