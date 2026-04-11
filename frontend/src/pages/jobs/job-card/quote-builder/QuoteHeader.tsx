import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Template { id: string; name: string; tags: string[]; }

interface QuoteHeaderQuote {
  id: string;
  quote_number: string;
  status: string;
  version_number: number;
}

interface QuoteHeaderProps {
  quote: QuoteHeaderQuote;
  onRefresh: () => void;
}

export function QuoteHeader({ quote, onRefresh }: QuoteHeaderProps) {
  const [loadOpen, setLoadOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateTags, setTemplateTags] = useState('');

  const { data: templates = [] } = useApiGet<Template[]>(['quote-templates'], '/v1/templates', { category: 'quote' });

  const loadTemplate = useApiMutation<void, { template_id: string }>('post', `/v1/quotes/${quote.id}/load-template`, [['quote', quote.id]]);
  const saveTemplate = useApiMutation<void, { quote_id: string; template_name: string; tags: string[] }>('post', '/v1/templates/save-from-quote', [['quote-templates']]);

  const handleLoad = async () => {
    if (!selectedTemplateId) return;
    await loadTemplate.mutateAsync({ template_id: selectedTemplateId });
    toast.success('Template loaded');
    setConfirmLoad(false); setLoadOpen(false); setSelectedTemplateId('');
    onRefresh();
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;
    await saveTemplate.mutateAsync({ quote_id: quote.id, template_name: templateName.trim(), tags: templateTags.split(',').map((t) => t.trim()).filter(Boolean) });
    toast.success('Template saved');
    setSaveOpen(false); setTemplateName(''); setTemplateTags('');
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
          <Button variant="outline" size="sm" onClick={() => setLoadOpen(true)}>Load Template</Button>
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>Save as Template</Button>
        </div>
      </div>

      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Load Template</DialogTitle></DialogHeader>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadOpen(false)}>Cancel</Button>
            <Button onClick={() => setConfirmLoad(true)} disabled={!selectedTemplateId}>Load</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmLoad} onOpenChange={setConfirmLoad} title="Load template?" description="This will ADD sections to your quote. Existing sections are kept." onConfirm={handleLoad} />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Template Name</Label><Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Spring Cleanup Standard" /></div>
            <div className="space-y-1"><Label>Tags (comma-separated)</Label><Input value={templateTags} onChange={(e) => setTemplateTags(e.target.value)} placeholder="spring, cleanup, residential" /></div>
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
