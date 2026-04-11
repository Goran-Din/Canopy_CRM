import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiGet } from '@/hooks/useApi';
import { EmailTemplateEditor } from './EmailTemplateEditor';

interface EmailTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  automation_name: string | null;
}

export function EmailTemplateList() {
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);

  const { data: templates = [], refetch } = useApiGet<EmailTemplate[]>(
    ['templates', 'email'], '/v1/templates', { category: 'email' },
  );

  if (editingId !== null) {
    return (
      <EmailTemplateEditor
        templateId={editingId === 'new' ? null : editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => { setEditingId(null); refetch(); }}
      />
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Email Templates</h3>
        <Button onClick={() => setEditingId('new')}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{t.name}</span>
                <Badge variant="outline" className="text-xs">
                  {t.channel === 'both' ? 'Email + SMS' : t.channel === 'sms' ? 'SMS' : 'Email'}
                </Badge>
              </div>
              {t.subject && <p className="text-xs text-muted-foreground pl-0">Subject: {t.subject}</p>}
              {t.automation_name && (
                <p className="text-xs text-muted-foreground">(Used by Automation: {t.automation_name})</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditingId(t.id)}>Edit</Button>
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No email templates.</p>}
      </div>
    </div>
  );
}
