import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { QuoteHeader } from './QuoteHeader';
import { SectionEditor } from './SectionEditor';
import { TotalsBar } from './TotalsBar';
import { SendQuoteDialog } from './SendQuoteDialog';
import { EstimationPanel } from './EstimationPanel';

// Re-export types from child components for external consumers
export type { QuoteLineItem } from './LineItemRow';
export type { QuoteSection } from './SectionEditor';

export interface Quote {
  id: string;
  quote_number: string;
  status: string;
  version_number: number;
  client_notes: string | null;
  payment_terms: string | null;
  valid_until: string | null;
  tax_enabled: boolean;
  tax_rate: number;
  discount_amount: number;
  subtotal: number;
  total: number;
  sections: import('./SectionEditor').QuoteSection[];
  pdf_file_id: string | null;
}

interface QuoteBuilderProps {
  quoteId: string;
  jobId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  propertyAddress?: string | null;
  propertyCategory?: string | null;
  onSent?: () => void;
}

export default function QuoteBuilder({
  quoteId,
  jobId: _jobId,
  customerEmail,
  customerPhone,
  propertyAddress,
  propertyCategory,
  onSent,
}: QuoteBuilderProps) {
  const [sendOpen, setSendOpen] = useState(false);
  const [clientNotes, setClientNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('8.75');
  const [initialized, setInitialized] = useState(false);

  const { data: quote, refetch } = useApiGet<Quote>(
    ['quote', quoteId],
    `/v1/quotes/${quoteId}`,
  );

  // Sync local state from fetched quote (once)
  if (quote && !initialized) {
    setClientNotes(quote.client_notes || '');
    setPaymentTerms(quote.payment_terms || '');
    setValidUntil(quote.valid_until || '');
    setTaxEnabled(quote.tax_enabled);
    setTaxRate(String(quote.tax_rate || 8.75));
    setInitialized(true);
  }

  const patchQuote = useApiMutation<void, Record<string, unknown>>(
    'patch',
    `/v1/quotes/${quoteId}`,
    [['quote', quoteId]],
  );

  const addSection = useApiMutation<void, { title: string }>(
    'post',
    `/v1/quotes/${quoteId}/sections`,
    [['quote', quoteId]],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sortedSections = useMemo(
    () => (quote?.sections || []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [quote?.sections],
  );

  const computedSubtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.sections.reduce(
      (sum, sec) => sum + sec.line_items.reduce(
        (s, item) => s + ((item.quantity || 0) * (item.unit_price || 0)),
        0,
      ),
      0,
    );
  }, [quote]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSections.findIndex((s) => s.id === active.id);
    const newIndex = sortedSections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sortedSections];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // PATCH each section with new sort_order using apiClient directly
    const { apiClient } = await import('@/api/client');
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await apiClient.patch(`/v1/quotes/${quoteId}/sections/${reordered[i].id}`, { sort_order: i });
      }
    }
    refetch();
  };

  const handleAddSection = async () => {
    await addSection.mutateAsync({ title: 'New Section' });
    refetch();
  };

  const handleSaveDraft = async () => {
    await patchQuote.mutateAsync({
      client_notes: clientNotes || null,
      payment_terms: paymentTerms || null,
      valid_until: validUntil || null,
      tax_enabled: taxEnabled,
      tax_rate: parseFloat(taxRate) || 0,
    });
    toast.success('Draft saved');
  };

  const handleGenerateAndSend = () => {
    if (!quote) return;
    const hasPricedItem = quote.sections.some(
      (s) => s.line_items.some((i) => i.unit_price != null && i.unit_price > 0),
    );
    if (!hasPricedItem) {
      toast.error('Quote must have at least one priced line item before sending.');
      return;
    }
    setSendOpen(true);
  };

  if (!quote) return null;

  return (
    <div className="flex gap-6 mt-4">
      {/* Left: Editor */}
      <div className="flex-1 min-w-0 space-y-4">
        <QuoteHeader quote={quote} onRefresh={refetch} />

        {/* Quote-level fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Client Notes</Label>
            <Textarea value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} onBlur={() => patchQuote.mutateAsync({ client_notes: clientNotes || null })} placeholder="Notes shown on PDF to client..." className="min-h-[60px] text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Payment Terms</Label>
            <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} onBlur={() => patchQuote.mutateAsync({ payment_terms: paymentTerms || null })} placeholder="Payment terms..." className="min-h-[40px] text-sm" />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valid Until</Label>
              <Input type="date" value={validUntil} onChange={(e) => { setValidUntil(e.target.value); patchQuote.mutateAsync({ valid_until: e.target.value || null }); }} className="h-8 text-sm w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={taxEnabled} onCheckedChange={(checked) => { setTaxEnabled(checked); patchQuote.mutateAsync({ tax_enabled: checked }); }} />
              <Label className="text-sm">Tax</Label>
              {taxEnabled && (
                <div className="flex items-center gap-1">
                  <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} onBlur={() => patchQuote.mutateAsync({ tax_rate: parseFloat(taxRate) || 0 })} className="h-8 w-20 text-sm" step="any" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sections with DND */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedSections.map((section) => (
                <SectionEditor key={section.id} section={section} quoteId={quoteId} onUpdate={refetch} onDelete={refetch} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button variant="outline" onClick={handleAddSection}>
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>

        <TotalsBar quote={quote} computedSubtotal={computedSubtotal} />

        <div className="flex gap-3 pt-2">
          <Button className="bg-[#2E7D32] hover:bg-[#256429]" onClick={handleGenerateAndSend}>Generate & Send</Button>
          <Button variant="outline" onClick={handleSaveDraft}>Save Draft</Button>
        </div>
      </div>

      {/* Right: Estimation Panel (desktop only) */}
      <div className="hidden lg:block w-72 shrink-0">
        <EstimationPanel propertyAddress={propertyAddress ?? null} propertyCategory={propertyCategory ?? null} />
      </div>

      <SendQuoteDialog quoteId={quoteId} customerEmail={customerEmail ?? null} customerPhone={customerPhone ?? null} open={sendOpen} onClose={() => setSendOpen(false)} onSent={() => { setSendOpen(false); onSent?.(); refetch(); }} />
    </div>
  );
}
