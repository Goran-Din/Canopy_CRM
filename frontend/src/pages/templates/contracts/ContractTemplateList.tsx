import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface ContractTemplate {
  id: string;
  name: string;
  tags: string[];
  body: string;
  is_active: boolean;
}

export function ContractTemplateList() {
  const [search, setSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);

  const { data: templates = [], refetch } = useApiGet<ContractTemplate[]>(
    ['templates', 'contract'], '/v1/templates', { category: 'contract' },
  );

  const createMut = useApiMutation<void, Record<string, unknown>>('post', '/v1/templates', [['templates', 'contract']]);
  const patchMut = useApiMutation<void, Record<string, unknown>>('patch', (vars) => `/v1/templates/${vars._id}`, [['templates', 'contract']]);
  const deleteMut = useApiMutation<void, { id: string }>('delete', (vars) => `/v1/templates/${vars.id}`, [['templates', 'contract']]);

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q));
  });

  const openEdit = (t: ContractTemplate) => {
    setEditingTemplate(t); setIsNew(false);
    setEditName(t.name); setEditBody(t.body || ''); setEditTags(t.tags.join(', '));
  };

  const openNew = () => {
    setEditingTemplate({} as ContractTemplate); setIsNew(true);
    setEditName(''); setEditBody(''); setEditTags('');
  };

  const handleSave = async () => {
    if (!editName.trim()) { toast.error('Name is required.'); return; }
    const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      if (isNew) {
        await createMut.mutateAsync({ name: editName.trim(), category: 'contract', tags, body: editBody });
      } else {
        await patchMut.mutateAsync({ _id: editingTemplate!.id, name: editName.trim(), tags, body: editBody });
      }
      toast.success('Template saved');
      setEditingTemplate(null); refetch();
    } catch { toast.error('Failed to save.'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync({ id: deleteTarget.id });
    toast.success('Template deleted'); setDeleteTarget(null); refetch();
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
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
              {t.tags.length > 0 && (
                <div className="flex gap-1 pl-4">
                  {t.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => openEdit(t)}>Edit</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(t)}>Delete</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No contract templates.</p>}
      </div>

      <Dialog open={!!editingTemplate} onOpenChange={(o) => !o && setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{isNew ? 'New Contract Template' : 'Edit Contract Template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Tags (comma-separated)</Label><Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="e.g. residential, annual" /></div>
            <div className="space-y-1"><Label>Template Body</Label><Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[200px]" placeholder="Contract template text..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete template?" description={`Delete "${deleteTarget?.name}"?`} onConfirm={handleDelete} variant="destructive" />
    </div>
  );
}
