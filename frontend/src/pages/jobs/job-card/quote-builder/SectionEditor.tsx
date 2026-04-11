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
import type { QuoteLineItem } from './LineItemRow';

export interface QuoteSection {
  id: string;
  title: string;
  body: string | null;
  sort_order: number;
  line_items: QuoteLineItem[];
}

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

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const patchSection = useApiMutation<void, Record<string, unknown>>(
    'patch', `/v1/quotes/${quoteId}/sections/${section.id}`, [['quote', quoteId]],
  );

  const deleteSection = useApiMutation<void, void>(
    'delete', `/v1/quotes/${quoteId}/sections/${section.id}`, [['quote', quoteId]],
  );

  const addItem = useApiMutation<void, Record<string, unknown>>(
    'post', `/v1/quotes/${quoteId}/sections/${section.id}/items`, [['quote', quoteId]],
  );

  const handleDeleteSection = async () => {
    await deleteSection.mutateAsync(undefined as never);
    onDelete();
  };

  const handleAddItem = async () => {
    await addItem.mutateAsync({ item_name: '', description: '', quantity: 1, unit: 'ea', unit_price: null });
    onUpdate();
  };

  const sortedItems = [...section.line_items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => patchSection.mutateAsync({ title })} placeholder="Section title" className="h-8 text-sm font-semibold flex-1" />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (section.line_items.length > 0) { setShowConfirm(true); } else { handleDeleteSection(); } }}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <Textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => patchSection.mutateAsync({ body: body || null })} placeholder="Section description (optional)" className="min-h-[32px] text-sm mb-3 resize-none" />

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
              <LineItemRow key={item.id} item={item} quoteId={quoteId} sectionId={section.id} onUpdate={onUpdate} onDelete={onUpdate} />
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="ghost" size="sm" className="mt-2" onClick={handleAddItem}>
        <Plus className="h-4 w-4 mr-1" />
        Add Line Item
      </Button>

      <ConfirmDialog open={showConfirm} onOpenChange={setShowConfirm} title="Delete section?" description={`Delete "${section.title}" and its ${section.line_items.length} line item(s)?`} onConfirm={() => { setShowConfirm(false); handleDeleteSection(); }} variant="destructive" />
    </div>
  );
}
