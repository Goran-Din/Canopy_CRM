import { useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface TemplateItem {
  item_name: string;
  description: string;
  xero_item_code: string | null;
}

interface TemplateSection {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  items: TemplateItem[];
}

interface TemplateDetail {
  id: string;
  name: string;
  tags: string[];
  is_system: boolean;
  sections: TemplateSection[];
}

interface QuoteTemplateEditorProps {
  templateId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function SortableSection({ section, index, onUpdate, onDelete }: {
  section: TemplateSection; index: number;
  onUpdate: (idx: number, section: TemplateSection) => void;
  onDelete: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id || `sec-${index}` });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
  };

  const updateItem = (itemIdx: number, field: string, value: string) => {
    const items = [...section.items];
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    onUpdate(index, { ...section, items });
  };

  const addItem = () => {
    onUpdate(index, { ...section, items: [...section.items, { item_name: '', description: '', xero_item_code: null }] });
  };

  const removeItem = (itemIdx: number) => {
    const items = section.items.filter((_, i) => i !== itemIdx);
    onUpdate(index, { ...section, items });
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Input value={section.title} onChange={(e) => onUpdate(index, { ...section, title: e.target.value })} placeholder="Section title" className="h-8 text-sm font-semibold flex-1" />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onDelete(index)}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
      <Textarea value={section.body} onChange={(e) => onUpdate(index, { ...section, body: e.target.value })} placeholder="Section description (optional)" className="min-h-[32px] text-sm resize-none" />

      {/* Items — no price/quantity fields */}
      <div className="space-y-2">
        {section.items.map((item, itemIdx) => (
          <div key={itemIdx} className="flex items-center gap-2">
            <Input value={item.item_name} onChange={(e) => updateItem(itemIdx, 'item_name', e.target.value)} placeholder="Item name" className="h-8 text-sm flex-1" />
            <Input value={item.description} onChange={(e) => updateItem(itemIdx, 'description', e.target.value)} placeholder="Description" className="h-8 text-sm flex-1" />
            <Input value={item.xero_item_code || ''} onChange={(e) => updateItem(itemIdx, 'xero_item_code', e.target.value)} placeholder="Xero code" className="h-8 text-sm w-32" />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeItem(itemIdx)}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>
    </div>
  );
}

export function QuoteTemplateEditor({ templateId, onClose, onSaved }: QuoteTemplateEditorProps) {
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [isSystem, setIsSystem] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: template } = useApiGet<TemplateDetail>(
    ['template', templateId ?? ''],
    `/v1/templates/${templateId}`,
    undefined,
    { enabled: !!templateId },
  );

  if (template && !initialized) {
    setName(template.name);
    setTags(template.tags);
    setSections(template.sections);
    setIsSystem(template.is_system);
    setInitialized(true);
  }

  const createMut = useApiMutation<void, Record<string, unknown>>('post', '/v1/templates', [['templates', 'quote']]);
  const patchMut = useApiMutation<void, Record<string, unknown>>('patch', `/v1/templates/${templateId}`, [['templates', 'quote']]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => (s.id || `sec-${sections.indexOf(s)}`) === active.id);
    const newIdx = sections.findIndex((s) => (s.id || `sec-${sections.indexOf(s)}`) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = [...sections];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    setSections(reordered.map((s, i) => ({ ...s, sort_order: i })));
  };

  const addSection = () => {
    setSections([...sections, { id: `new-${Date.now()}`, title: 'New Section', body: '', sort_order: sections.length, items: [] }]);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Template name is required.'); return; }
    const payload = { name: name.trim(), category: 'quote', tags, sections: sections.map((s, i) => ({ ...s, sort_order: i })) };
    try {
      if (templateId) { await patchMut.mutateAsync(payload); } else { await createMut.mutateAsync(payload); }
      toast.success('Template saved');
      onSaved();
    } catch { toast.error('Failed to save template.'); }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{templateId ? 'Edit Template' : 'New Template'}</h3>
        <div className="flex gap-2">
          <Button onClick={handleSave}>Save</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>

      {isSystem && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          This is a system template. Your changes will apply to all new quotes using this template.
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Template Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Cleanup Standard" />
        </div>
        <div className="space-y-1">
          <Label>Tags</Label>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                {tag} <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            <div className="flex gap-1">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add tag" className="h-8 w-32 text-sm" />
              <Button variant="outline" size="sm" className="h-8" onClick={addTag}>Add</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Sections</h4>
          <Button variant="outline" size="sm" onClick={addSection}><Plus className="h-4 w-4 mr-1" /> Add Section</Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s, i) => s.id || `sec-${i}`)} strategy={verticalListSortingStrategy}>
            {sections.map((section, idx) => (
              <SortableSection
                key={section.id || `sec-${idx}`}
                section={section}
                index={idx}
                onUpdate={(i, s) => { const next = [...sections]; next[i] = s; setSections(next); }}
                onDelete={(i) => setSections(sections.filter((_, j) => j !== i))}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
