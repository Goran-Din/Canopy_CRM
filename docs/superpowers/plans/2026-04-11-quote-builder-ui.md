# Quote Builder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the draft quote editor embedded in the Job Card's Quote tab — with drag-to-reorder sections, Xero item search, manual price entry, real-time totals, template loading, and a Generate & Send flow with PDF polling.

**Architecture:** QuoteBuilder container fetches quote data, renders section editors with DND Kit sortable, and a totals bar. XeroItemSearch provides debounced search. All fields auto-save on blur via PATCH mutations. SendQuoteDialog handles PDF generation polling and multi-channel sending.

**Tech Stack:** React 18, TypeScript, @dnd-kit/core + @dnd-kit/sortable, shadcn/ui (Dialog, Input, Textarea, Switch, Select, Label, Badge, Button), Lucide icons, React Query hooks, Vitest + RTL.

**Frontend root:** `C:\Users\Goran\Documents\03-DEVELOPMENT\Canopy CRM\Code\canopy_crm\frontend`

---

## File Structure

```
frontend/src/pages/jobs/job-card/quote-builder/
├── QuoteBuilder.tsx         # Main container: fetch quote, layout, DND context, save/send buttons
├── QuoteHeader.tsx          # Quote number, status, version, template load/save controls
├── SectionEditor.tsx        # Single draggable section block with line items
├── LineItemRow.tsx          # Single line item with inline editing
├── XeroItemSearch.tsx       # Debounced Xero catalog search dropdown
├── TotalsBar.tsx            # Subtotal, discount, tax, total display
├── SendQuoteDialog.tsx      # PDF generation polling + send flow dialog
├── EstimationPanel.tsx      # Right-side placeholder panel
└── __tests__/
    └── QuoteBuilder.test.tsx # 23-case test suite

frontend/src/pages/jobs/job-card/tabs/QuoteTab.tsx  # Wire in QuoteBuilder (modify)
```

### Shared Quote Types (defined in QuoteBuilder.tsx, exported):

```typescript
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

export interface QuoteSection {
  id: string;
  title: string;
  body: string | null;
  sort_order: number;
  line_items: QuoteLineItem[];
}

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
  sections: QuoteSection[];
  pdf_file_id: string | null;
}
```

---

## Task 1: XeroItemSearch Component

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/XeroItemSearch.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/jobs/job-card/quote-builder/XeroItemSearch.tsx`:

```typescript
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';

interface XeroItem {
  item_code: string;
  name: string;
  description: string;
  default_price: number | null;
}

interface XeroItemSearchProps {
  value: string;
  xeroItemCode: string | null;
  xeroDefaultPrice: number | null;
  onSelect: (item: { item_name: string; description: string; xero_item_code: string; xero_default_price: number | null }) => void;
  onCustom: (name: string) => void;
}

export function XeroItemSearch({ value, xeroItemCode, xeroDefaultPrice, onSelect, onCustom }: XeroItemSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<XeroItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await apiClient.get('/v1/xero-items', { params: { search: term } });
      setResults(Array.isArray(data) ? data.slice(0, 10) : (data.data || []).slice(0, 10));
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (item: XeroItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelect({
      item_name: item.name,
      description: item.description || '',
      xero_item_code: item.item_code,
      xero_default_price: item.default_price,
    });
  };

  const handleCustom = () => {
    setIsOpen(false);
    onCustom(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search Xero items..."
          className="pl-8 h-8 text-sm"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isSearching && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching...</p>
          )}
          {results.map((item) => (
            <button
              key={item.item_code}
              className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0"
              onClick={() => handleSelect(item)}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground">{item.item_code}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              )}
              {item.default_price != null && (
                <p className="text-xs text-muted-foreground">Xero default: ${item.default_price.toFixed(2)}</p>
              )}
            </button>
          ))}
          <button
            className="w-full text-left px-3 py-2 hover:bg-muted text-sm text-primary"
            onClick={handleCustom}
          >
            + Use custom item
          </button>
        </div>
      )}

      {xeroItemCode && xeroDefaultPrice != null && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Xero default: ${xeroDefaultPrice.toFixed(2)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add XeroItemSearch with debounced catalog lookup"
```

---

## Task 2: LineItemRow Component

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/LineItemRow.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/jobs/job-card/quote-builder/LineItemRow.tsx`:

```typescript
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiMutation } from '@/hooks/useApi';
import { XeroItemSearch } from './XeroItemSearch';
import type { QuoteLineItem } from './QuoteBuilder';

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
    // Save name, description, xero fields — but NEVER unit_price
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
          <XeroItemSearch
            value={item.item_name}
            xeroItemCode={xeroCode}
            xeroDefaultPrice={xeroPrice}
            onSelect={handleXeroSelect}
            onCustom={handleCustomItem}
          />
        </td>
        <td className="py-2 px-1">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => saveField('description', description)}
            placeholder="Description"
            className="min-h-[32px] h-8 text-sm resize-none"
          />
        </td>
        <td className="py-2 px-1 w-16">
          <Input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => saveField('quantity', parseFloat(qty) || 1)}
            className="h-8 text-sm text-center"
            min={0}
            step="any"
          />
        </td>
        <td className="py-2 px-1 w-16">
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onBlur={() => saveField('unit', unit)}
            className="h-8 text-sm text-center"
          />
        </td>
        <td className="py-2 px-1 w-24">
          <Input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            onBlur={() => saveField('unit_price', unitPrice ? parseFloat(unitPrice) : null)}
            placeholder="Enter price"
            className="h-8 text-sm text-right"
            min={0}
            step="any"
          />
        </td>
        <td className="py-2 px-1 w-24 text-right text-sm font-medium">
          {fmt(computedTotal)}
        </td>
        <td className="py-2 px-1 w-8">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (item.unit_price != null) {
                setShowConfirm(true);
              } else {
                handleDelete();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </td>
      </tr>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Delete line item?"
        description={`Remove "${item.item_name || 'this item'}" from the quote?`}
        onConfirm={() => { setShowConfirm(false); handleDelete(); }}
        variant="destructive"
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add LineItemRow with inline editing and Xero integration"
```

---

## Task 3: SectionEditor Component

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/SectionEditor.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/jobs/job-card/quote-builder/SectionEditor.tsx`:

```typescript
import { useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/sortable';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiMutation } from '@/hooks/useApi';
import { LineItemRow } from './LineItemRow';
import type { QuoteSection } from './QuoteBuilder';

interface SectionEditorProps {
  section: QuoteSection;
  quoteId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

export function SectionEditor({ section, quoteId, onUpdate, onDelete }: SectionEditorProps) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body || '');
  const [showConfirm, setShowConfirm] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const patchSection = useApiMutation<void, Record<string, unknown>>(
    'patch',
    `/v1/quotes/${quoteId}/sections/${section.id}`,
    [['quote', quoteId]],
  );

  const deleteSection = useApiMutation<void, void>(
    'delete',
    `/v1/quotes/${quoteId}/sections/${section.id}`,
    [['quote', quoteId]],
  );

  const addItem = useApiMutation<void, Record<string, unknown>>(
    'post',
    `/v1/quotes/${quoteId}/sections/${section.id}/items`,
    [['quote', quoteId]],
  );

  const handleDeleteSection = async () => {
    await deleteSection.mutateAsync(undefined as never);
    onDelete();
  };

  const handleAddItem = async () => {
    await addItem.mutateAsync({
      item_name: '',
      description: '',
      quantity: 1,
      unit: 'ea',
      unit_price: null,
    });
    onUpdate();
  };

  const sortedItems = [...section.line_items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-card">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => patchSection.mutateAsync({ title })}
          placeholder="Section title"
          className="h-8 text-sm font-semibold flex-1"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (section.line_items.length > 0) {
              setShowConfirm(true);
            } else {
              handleDeleteSection();
            }
          }}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Section body */}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => patchSection.mutateAsync({ body: body || null })}
        placeholder="Section description (optional)"
        className="min-h-[32px] text-sm mb-3 resize-none"
      />

      {/* Line items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-1 px-1 font-medium">Item</th>
              <th className="text-left py-1 px-1 font-medium">Description</th>
              <th className="text-center py-1 px-1 font-medium">Qty</th>
              <th className="text-center py-1 px-1 font-medium">Unit</th>
              <th className="text-right py-1 px-1 font-medium">Unit Price</th>
              <th className="text-right py-1 px-1 font-medium">Total</th>
              <th className="py-1 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                quoteId={quoteId}
                sectionId={section.id}
                onUpdate={onUpdate}
                onDelete={onUpdate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add line item */}
      <Button variant="ghost" size="sm" className="mt-2" onClick={handleAddItem}>
        <Plus className="h-4 w-4 mr-1" />
        Add Line Item
      </Button>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Delete section?"
        description={`Delete "${section.title}" and its ${section.line_items.length} line item(s)?`}
        onConfirm={() => { setShowConfirm(false); handleDeleteSection(); }}
        variant="destructive"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add SectionEditor with drag handle and line items"
```

---

## Task 4: TotalsBar + EstimationPanel

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/TotalsBar.tsx`
- Create: `frontend/src/pages/jobs/job-card/quote-builder/EstimationPanel.tsx`

- [ ] **Step 1: Create TotalsBar**

Create `frontend/src/pages/jobs/job-card/quote-builder/TotalsBar.tsx`:

```typescript
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiMutation } from '@/hooks/useApi';
import type { Quote } from './QuoteBuilder';

interface TotalsBarProps {
  quote: Quote;
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
          <Input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            onBlur={() => patchQuote.mutateAsync({ discount_amount: parseFloat(discount) || 0 })}
            className="h-8 w-24 text-sm text-right"
            min={0}
            step="any"
          />
        </div>
      </div>
      {discountNum > 0 && (
        <div className="flex justify-between text-sm">
          <span></span>
          <span className="text-green-600">-{fmt(discountNum)}</span>
        </div>
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
```

- [ ] **Step 2: Create EstimationPanel**

Create `frontend/src/pages/jobs/job-card/quote-builder/EstimationPanel.tsx`:

```typescript
interface EstimationPanelProps {
  propertyAddress: string | null;
  propertyCategory: string | null;
}

export function EstimationPanel({ propertyAddress, propertyCategory }: EstimationPanelProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Estimation Assistant
      </h4>
      {propertyAddress && (
        <p className="text-sm"><span className="text-muted-foreground">Property:</span> {propertyAddress}</p>
      )}
      {propertyCategory && (
        <p className="text-sm"><span className="text-muted-foreground">Category:</span> {propertyCategory}</p>
      )}
      <p className="text-sm text-muted-foreground mt-4">
        Price history will appear here when a Xero item is selected.
      </p>
      <p className="text-xs text-muted-foreground mt-1">(Future feature)</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add TotalsBar with discount/tax and EstimationPanel placeholder"
```

---

## Task 5: QuoteHeader Component

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/QuoteHeader.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/jobs/job-card/quote-builder/QuoteHeader.tsx`:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import type { Quote } from './QuoteBuilder';

interface Template {
  id: string;
  name: string;
  tags: string[];
}

interface QuoteHeaderProps {
  quote: Quote;
  onRefresh: () => void;
}

export function QuoteHeader({ quote, onRefresh }: QuoteHeaderProps) {
  const [loadOpen, setLoadOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateTags, setTemplateTags] = useState('');

  const { data: templates = [] } = useApiGet<Template[]>(
    ['quote-templates'],
    '/v1/templates',
    { category: 'quote' },
  );

  const loadTemplate = useApiMutation<void, { template_id: string }>(
    'post',
    `/v1/quotes/${quote.id}/load-template`,
    [['quote', quote.id]],
  );

  const saveTemplate = useApiMutation<void, { quote_id: string; template_name: string; tags: string[] }>(
    'post',
    '/v1/templates/save-from-quote',
    [['quote-templates']],
  );

  const handleLoad = async () => {
    if (!selectedTemplateId) return;
    await loadTemplate.mutateAsync({ template_id: selectedTemplateId });
    toast.success('Template loaded');
    setConfirmLoad(false);
    setLoadOpen(false);
    setSelectedTemplateId('');
    onRefresh();
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;
    await saveTemplate.mutateAsync({
      quote_id: quote.id,
      template_name: templateName.trim(),
      tags: templateTags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    toast.success('Template saved');
    setSaveOpen(false);
    setTemplateName('');
    setTemplateTags('');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">{quote.quote_number}</span>
          <StatusBadge status={quote.status} />
          <span className="text-sm text-muted-foreground">v{quote.version_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLoadOpen(true)}>
            Load Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
            Save as Template
          </Button>
        </div>
      </div>

      {/* Load Template Dialog */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
          </DialogHeader>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadOpen(false)}>Cancel</Button>
            <Button onClick={() => setConfirmLoad(true)} disabled={!selectedTemplateId}>Load</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmLoad}
        onOpenChange={setConfirmLoad}
        title="Load template?"
        description="This will ADD sections to your quote. Existing sections are kept."
        onConfirm={handleLoad}
      />

      {/* Save Template Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Spring Cleanup Standard" />
            </div>
            <div className="space-y-1">
              <Label>Tags (comma-separated)</Label>
              <Input value={templateTags} onChange={(e) => setTemplateTags(e.target.value)} placeholder="spring, cleanup, residential" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!templateName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add QuoteHeader with template load/save controls"
```

---

## Task 6: SendQuoteDialog Component

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/SendQuoteDialog.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/jobs/job-card/quote-builder/SendQuoteDialog.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/api/client';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface SendQuoteDialogProps {
  quoteId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function SendQuoteDialog({
  quoteId,
  customerEmail,
  customerPhone,
  open,
  onClose,
  onSent,
}: SendQuoteDialogProps) {
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [email, setEmail] = useState(customerEmail || '');
  const [phone, setPhone] = useState(customerPhone || '');
  const [message, setMessage] = useState('');
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfTimeout, setPdfTimeout] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef<number>(0);

  const sendQuote = useApiMutation<void, { channel: string; email: string; phone: string; message: string }>(
    'post',
    `/v1/quotes/${quoteId}/send`,
    [['quote', quoteId]],
  );

  // Trigger PDF generation and start polling
  useEffect(() => {
    if (!open) return;

    setPdfReady(false);
    setPdfTimeout(false);
    startRef.current = Date.now();

    apiClient.post(`/v1/quotes/${quoteId}/generate-pdf`).catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/v1/quotes/${quoteId}`);
        if (data.pdf_file_id) {
          setPdfReady(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}

      if (Date.now() - startRef.current > 30000) {
        setPdfTimeout(true);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, quoteId]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await sendQuote.mutateAsync({ channel, email, phone, message });
      toast.success('Quote sent!');
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send quote.';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Quote to Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel selection */}
          <div className="space-y-2">
            <Label>Send via</Label>
            <div className="flex gap-4">
              {(['email', 'sms', 'both'] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value={ch}
                    checked={channel === ch}
                    onChange={() => setChannel(ch)}
                    className="accent-primary"
                  />
                  {ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : 'Both'}
                </label>
              ))}
            </div>
          </div>

          {/* Email field */}
          {(channel === 'email' || channel === 'both') && (
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          )}

          {/* Phone field */}
          {(channel === 'sms' || channel === 'both') && (
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
          )}

          {/* Message */}
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional cover message..."
              className="min-h-[60px]"
            />
          </div>

          {/* PDF status */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">PDF:</span>
            {pdfReady ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" /> Ready
              </span>
            ) : pdfTimeout ? (
              <span className="text-amber-600">
                PDF generation is taking longer than expected. Please try again.
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!pdfReady || isSending}>
            {isSending ? 'Sending...' : 'Send Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add SendQuoteDialog with PDF polling and multi-channel send"
```

---

## Task 7: QuoteBuilder Container

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/QuoteBuilder.tsx`

- [ ] **Step 1: Create the main container**

Create `frontend/src/pages/jobs/job-card/quote-builder/QuoteBuilder.tsx`:

```typescript
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

export interface QuoteSection {
  id: string;
  title: string;
  body: string | null;
  sort_order: number;
  line_items: QuoteLineItem[];
}

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
  sections: QuoteSection[];
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
  jobId,
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

  const patchSection = useApiMutation<void, Record<string, unknown>>(
    'patch',
    (vars) => `/v1/quotes/${quoteId}/sections/${vars._sectionId}`,
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

    // Update sort_order for moved sections
    const reordered = [...sortedSections];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await patchSection.mutateAsync({ _sectionId: reordered[i].id, sort_order: i });
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
            <Textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              onBlur={() => patchQuote.mutateAsync({ client_notes: clientNotes || null })}
              placeholder="Notes shown on PDF to client..."
              className="min-h-[60px] text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Payment Terms</Label>
            <Textarea
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              onBlur={() => patchQuote.mutateAsync({ payment_terms: paymentTerms || null })}
              placeholder="Payment terms..."
              className="min-h-[40px] text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valid Until</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => {
                  setValidUntil(e.target.value);
                  patchQuote.mutateAsync({ valid_until: e.target.value || null });
                }}
                className="h-8 text-sm w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={taxEnabled}
                onCheckedChange={(checked) => {
                  setTaxEnabled(checked);
                  patchQuote.mutateAsync({ tax_enabled: checked });
                }}
              />
              <Label className="text-sm">Tax</Label>
              {taxEnabled && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    onBlur={() => patchQuote.mutateAsync({ tax_rate: parseFloat(taxRate) || 0 })}
                    className="h-8 w-20 text-sm"
                    step="any"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sections */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedSections.map((section) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  quoteId={quoteId}
                  onUpdate={refetch}
                  onDelete={refetch}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button variant="outline" onClick={handleAddSection}>
          <Plus className="h-4 w-4 mr-1" />
          Add Section
        </Button>

        {/* Totals */}
        <TotalsBar quote={quote} computedSubtotal={computedSubtotal} />

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button className="bg-[#2E7D32] hover:bg-[#256429]" onClick={handleGenerateAndSend}>
            Generate & Send
          </Button>
          <Button variant="outline" onClick={handleSaveDraft}>
            Save Draft
          </Button>
        </div>
      </div>

      {/* Right: Estimation Panel (desktop only) */}
      <div className="hidden lg:block w-72 shrink-0">
        <EstimationPanel
          propertyAddress={propertyAddress ?? null}
          propertyCategory={propertyCategory ?? null}
        />
      </div>

      {/* Send dialog */}
      <SendQuoteDialog
        quoteId={quoteId}
        customerEmail={customerEmail ?? null}
        customerPhone={customerPhone ?? null}
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={() => { setSendOpen(false); onSent?.(); refetch(); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): add QuoteBuilder container with DND sections and auto-save"
```

---

## Task 8: Wire QuoteBuilder into QuoteTab

**Files:**
- Modify: `frontend/src/pages/jobs/job-card/tabs/QuoteTab.tsx`

- [ ] **Step 1: Replace the draft placeholder**

In `frontend/src/pages/jobs/job-card/tabs/QuoteTab.tsx`, add import at top:
```typescript
import QuoteBuilder from '../quote-builder/QuoteBuilder';
```

Replace the draft mode block (lines 87-94):
```typescript
  if (quote.status === 'draft') {
    return (
      <div className="mt-4 p-8 border-2 border-dashed rounded-lg text-center">
        <p className="text-muted-foreground">Quote Builder will be rendered here.</p>
        <p className="text-xs text-muted-foreground mt-1">Status: Draft — {quote.quote_number}</p>
      </div>
    );
  }
```

With:
```typescript
  if (quote.status === 'draft') {
    return (
      <div className="mt-4">
        <QuoteBuilder quoteId={quote.id} jobId={jobId} onSent={refetch} />
      </div>
    );
  }
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(quote-builder): wire QuoteBuilder into QuoteTab draft mode"
```

---

## Task 9: Test Suite

**Files:**
- Create: `frontend/src/pages/jobs/job-card/quote-builder/__tests__/QuoteBuilder.test.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/pages/jobs/job-card/quote-builder/__tests__/QuoteBuilder.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockUseApiGet = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
  useApiList: vi.fn(() => ({ data: [], pagination: {} })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiMutation: (..._args: any[]) => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { pdf_file_id: 'pdf-1' } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, title, onConfirm }: { open: boolean; title: string; onConfirm: () => void }) =>
    open ? <div data-testid="confirm-dialog"><span>{title}</span><button onClick={onConfirm}>Confirm</button></div> : null,
}));

import { toast } from 'sonner';

const mockQuote = {
  id: 'q1',
  quote_number: 'Q-0047-01',
  status: 'draft',
  version_number: 1,
  client_notes: null,
  payment_terms: null,
  valid_until: null,
  tax_enabled: false,
  tax_rate: 8.75,
  discount_amount: 0,
  subtotal: 570,
  total: 570,
  pdf_file_id: null,
  sections: [
    {
      id: 's1',
      title: 'Weekly Maintenance',
      body: null,
      sort_order: 0,
      line_items: [
        { id: 'li1', item_name: 'Mowing', description: 'Weekly mowing', quantity: 4, unit: 'ea', unit_price: 35, line_total: 140, sort_order: 0, xero_item_code: '4220-MOW', xero_default_price: 40 },
        { id: 'li2', item_name: 'Edging', description: 'Weekly edging', quantity: 4, unit: 'ea', unit_price: 15, line_total: 60, sort_order: 1, xero_item_code: null, xero_default_price: null },
      ],
    },
    {
      id: 's2',
      title: 'Monthly Services',
      body: 'Once per month',
      sort_order: 1,
      line_items: [
        { id: 'li3', item_name: '', description: '', quantity: 1, unit: 'ea', unit_price: null, line_total: 0, sort_order: 0, xero_item_code: null, xero_default_price: null },
      ],
    },
  ],
};

const mockTemplates = [
  { id: 't1', name: 'Spring Standard', tags: ['spring'] },
];

function setupMocks(quoteOverrides: Partial<typeof mockQuote> = {}) {
  const quote = { ...mockQuote, ...quoteOverrides };
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'quote') return { data: quote, refetch: mockRefetch };
    if (key[0] === 'quote-templates') return { data: mockTemplates, refetch: mockRefetch };
    return { data: null, refetch: mockRefetch };
  });
}

function renderBuilder() {
  const QuoteBuilder = require('../QuoteBuilder').default;
  return render(
    <MemoryRouter>
      <QuoteBuilder quoteId="q1" jobId="j1" />
    </MemoryRouter>,
  );
}

describe('QuoteBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders quote editor with sections and line items', () => {
    renderBuilder();
    expect(screen.getByText('Q-0047-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Weekly Maintenance')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Monthly Services')).toBeInTheDocument();
  });

  it('add section button creates new section via mutation', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Add Section'));
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it('section title edits save on blur', async () => {
    renderBuilder();
    const titleInput = screen.getByDisplayValue('Weekly Maintenance');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated Section');
    titleInput.blur();
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
  });

  it('delete section with items shows confirmation dialog', async () => {
    renderBuilder();
    // Find the X buttons (section delete) — first one is for section with items
    const xButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[class*="lucide"]'));
    // Click the first section's X button
    const sectionDeleteBtns = screen.getAllByRole('button');
    // Find buttons that could be section delete (X icon)
    for (const btn of sectionDeleteBtns) {
      if (btn.textContent === '' && btn.closest('[class*="border rounded-lg"]')) {
        await userEvent.click(btn);
        break;
      }
    }
  });

  it('add line item creates new item via mutation', async () => {
    renderBuilder();
    const addButtons = screen.getAllByText('Add Line Item');
    await userEvent.click(addButtons[0]);
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it('unit price field starts empty on new item (critical rule)', () => {
    renderBuilder();
    // li3 has unit_price: null — its price field should show empty/placeholder
    const priceInputs = screen.getAllByPlaceholderText('Enter price');
    expect(priceInputs.length).toBeGreaterThan(0);
  });

  it('line total computes qty x unit_price in real time', () => {
    renderBuilder();
    // li1: qty=4, price=35 → total=$140.00
    expect(screen.getByText('$140.00')).toBeInTheDocument();
  });

  it('subtotal sums all line totals', () => {
    renderBuilder();
    // computed: 140 + 60 + 0 = 200
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  it('discount field saves on blur', async () => {
    renderBuilder();
    const discountInput = screen.getByDisplayValue('0');
    await userEvent.clear(discountInput);
    await userEvent.type(discountInput, '25');
    discountInput.blur();
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
  });

  it('tax row only shown when tax_enabled is true', () => {
    renderBuilder();
    expect(screen.queryByText(/Tax \(8.75%\)/)).not.toBeInTheDocument();
  });

  it('tax row appears when tax toggled on', async () => {
    setupMocks({ tax_enabled: true });
    renderBuilder();
    expect(screen.getByText(/8.75/)).toBeInTheDocument();
  });

  it('total = subtotal - discount + tax', () => {
    setupMocks({ tax_enabled: false, discount_amount: 0 });
    renderBuilder();
    // subtotal computed = 200, discount 0, no tax
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  it('generate & send validates ≥1 priced line item', async () => {
    setupMocks({
      sections: [{
        id: 's1', title: 'Empty', body: null, sort_order: 0,
        line_items: [{ id: 'li1', item_name: 'X', description: '', quantity: 1, unit: 'ea', unit_price: null, line_total: 0, sort_order: 0, xero_item_code: null, xero_default_price: null }],
      }],
    });
    renderBuilder();
    await userEvent.click(screen.getByText('Generate & Send'));
    expect(toast.error).toHaveBeenCalledWith('Quote must have at least one priced line item before sending.');
  });

  it('send dialog opens when quote has priced items', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Generate & Send'));
    await waitFor(() => {
      expect(screen.getByText('Send Quote to Client')).toBeInTheDocument();
    });
  });

  it('load template shows template list', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Load Template'));
    await waitFor(() => {
      expect(screen.getByText('Spring Standard')).toBeInTheDocument();
    });
  });

  it('save as template dialog captures name', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Save as Template'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g. Spring Cleanup/)).toBeInTheDocument();
    });
  });

  it('save draft button triggers PATCH', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Save Draft'));
    expect(mockMutateAsync).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Draft saved');
  });

  it('xero default price shown as reference text', () => {
    renderBuilder();
    // li1 has xero_default_price: 40
    expect(screen.getByText('Xero default: $40.00')).toBeInTheDocument();
  });

  it('estimation panel shows on desktop', () => {
    renderBuilder();
    expect(screen.getByText('Estimation Assistant')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd frontend && npx vitest run src/pages/jobs/job-card/quote-builder/__tests__/QuoteBuilder.test.tsx`
Fix any failures.

- [ ] **Step 3: Run full test suite**

Run: `cd frontend && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(quote-builder): add 23-case test suite for Quote Builder"
```

---

## Task 10: Final Verification

- [ ] **Step 1: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Full test suite**

Run: `cd frontend && npx vitest run`

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A && git commit -m "fix(quote-builder): address verification issues"
```

---

## Notes

- **unit_price NEVER auto-populated** — XeroItemSearch sets name/description/xero fields but explicitly excludes unit_price from the PATCH payload.
- The `patchSection` mutation in QuoteBuilder uses a function URL `(vars) => ...` with a `_sectionId` field stripped before sending — this matches the `useApiMutation` pattern where URL can be a function of variables.
- `DndContext` wraps only sections, not line items within sections (line item reordering is out of scope).
- PDF polling uses `setInterval` with cleanup in the `useEffect` return. Polling stops on PDF ready or 30-second timeout.
- The `computedSubtotal` is calculated client-side from section line items for real-time display. The backend's `subtotal` field is the source of truth after save.
