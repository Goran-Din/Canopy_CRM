import { useState } from 'react';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { QuoteTemplateEditor } from './QuoteTemplateEditor';

interface Template {
  id: string;
  name: string;
  tags: string[];
  is_active: boolean;
  is_system: boolean;
  sections: { title: string }[];
}

export function QuoteTemplateList() {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates = [], refetch } = useApiGet<Template[]>(
    ['templates', 'quote'],
    '/v1/templates',
    { category: 'quote' },
  );

  const deleteMut = useApiMutation<void, { id: string }>(
    'delete',
    (vars) => `/v1/templates/${vars.id}`,
    [['templates', 'quote']],
  );

  const patchMut = useApiMutation<void, { id: string; is_active: boolean }>(
    'patch',
    (vars) => `/v1/templates/${vars.id}`,
    [['templates', 'quote']],
  );

  const duplicateMut = useApiMutation<void, Record<string, unknown>>(
    'post',
    '/v1/templates',
    [['templates', 'quote']],
  );

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q));
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ id: deleteTarget.id });
      toast.success('Template deleted');
      setDeleteTarget(null);
      refetch();
    } catch { toast.error('Failed to delete template.'); }
  };

  const handleToggleActive = async (t: Template) => {
    await patchMut.mutateAsync({ id: t.id, is_active: !t.is_active });
    toast.success(t.is_active ? 'Template deactivated' : 'Template activated');
    refetch();
  };

  const handleDuplicate = async (t: Template) => {
    await duplicateMut.mutateAsync({ name: `${t.name} (Copy)`, category: 'quote', tags: t.tags, is_active: true });
    toast.success('Template duplicated');
    refetch();
  };

  if (editingId !== null) {
    return (
      <QuoteTemplateEditor
        templateId={editingId === 'new' ? null : editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => { setEditingId(null); refetch(); }}
      />
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
        </div>
        <Button onClick={() => setEditingId('new')}>
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="font-medium text-sm">{t.name}</span>
                {!t.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
              </div>
              <div className="flex items-center gap-2 pl-4">
                {t.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                {t.sections.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Sections: {t.sections.map((s) => s.title).join(' / ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setEditingId(t.id)}>Edit</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDuplicate(t)}>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleActive(t)}>
                    {t.is_active ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                  {!t.is_system && (
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(t)}>Delete</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No templates found.</p>}
      </div>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete template?" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} variant="destructive" />
    </div>
  );
}
