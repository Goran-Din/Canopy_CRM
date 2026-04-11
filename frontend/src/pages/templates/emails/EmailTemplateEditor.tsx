import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

const MERGE_FIELDS = [
  '{{client_first_name}}', '{{client_last_name}}', '{{job_number}}',
  '{{signing_link}}', '{{valid_until}}', '{{property_address}}',
  '{{company_phone}}', '{{company_email}}', '{{company_name}}', '{{scheduled_date}}',
];

const SAMPLE_DATA: Record<string, string> = {
  '{{client_first_name}}': 'John', '{{client_last_name}}': 'Smith', '{{job_number}}': '0047-26',
  '{{signing_link}}': 'https://app.sunsetservices.com/sign/abc123',
  '{{valid_until}}': 'May 1, 2026', '{{property_address}}': '1348 Oak St, Naperville IL',
  '{{company_phone}}': '(630) 555-0100', '{{company_email}}': 'info@sunsetservices.com',
  '{{company_name}}': 'Sunset Services', '{{scheduled_date}}': 'April 15, 2026',
};

interface EmailDetail {
  id: string;
  name: string;
  channel: string;
  subject: string;
  email_body: string;
  sms_body: string;
}

interface EmailTemplateEditorProps {
  templateId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EmailTemplateEditor({ templateId, onClose, onSaved }: EmailTemplateEditorProps) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const lastFocusedRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const { data: template } = useApiGet<EmailDetail>(
    ['template', templateId ?? ''], `/v1/templates/${templateId}`, undefined, { enabled: !!templateId },
  );

  if (template && !initialized) {
    setName(template.name); setChannel(template.channel as 'email' | 'sms' | 'both');
    setSubject(template.subject || ''); setEmailBody(template.email_body || '');
    setSmsBody(template.sms_body || ''); setInitialized(true);
  }

  const createMut = useApiMutation<void, Record<string, unknown>>('post', '/v1/templates', [['templates', 'email']]);
  const patchMut = useApiMutation<void, Record<string, unknown>>('patch', `/v1/templates/${templateId}`, [['templates', 'email']]);

  const insertMergeField = (field: string) => {
    const el = lastFocusedRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const newValue = el.value.substring(0, start) + field + el.value.substring(end);

    if (el === document.querySelector('[data-field="subject"]')) setSubject(newValue);
    else if (el === document.querySelector('[data-field="email-body"]')) setEmailBody(newValue);
    else if (el === document.querySelector('[data-field="sms-body"]')) setSmsBody(newValue);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required.'); return; }
    const payload = { name: name.trim(), category: 'email', channel, subject, email_body: emailBody, sms_body: smsBody };
    try {
      if (templateId) { await patchMut.mutateAsync(payload); } else { await createMut.mutateAsync(payload); }
      toast.success('Template saved'); onSaved();
    } catch { toast.error('Failed to save.'); }
  };

  const fillPreview = (text: string) => {
    let result = text;
    for (const [key, val] of Object.entries(SAMPLE_DATA)) {
      result = result.split(key).join(val);
    }
    return result;
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{templateId ? 'Edit Email Template' : 'New Email Template'}</h3>
        <div className="flex gap-2">
          <Button onClick={handleSave}>Save</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>

        <div className="space-y-1">
          <Label>Channel</Label>
          <div className="flex gap-4">
            {(['email', 'sms', 'both'] as const).map((ch) => (
              <label key={ch} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="channel" value={ch} checked={channel === ch} onChange={() => setChannel(ch)} className="accent-primary" />
                {ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : 'Both'}
              </label>
            ))}
          </div>
        </div>

        {(channel === 'email' || channel === 'both') && (
          <>
            <div className="space-y-1">
              <Label>Email Subject</Label>
              <Input data-field="subject" value={subject} onChange={(e) => setSubject(e.target.value)} onFocus={(e) => { lastFocusedRef.current = e.target; }} />
            </div>
            <div className="space-y-1">
              <Label>Email Body</Label>
              <Textarea data-field="email-body" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} onFocus={(e) => { lastFocusedRef.current = e.target; }} className="min-h-[120px]" />
            </div>
          </>
        )}

        {(channel === 'sms' || channel === 'both') && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>SMS Body</Label>
              <span className={`text-xs ${smsBody.length > 160 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                {smsBody.length}/160 chars
              </span>
            </div>
            <Textarea data-field="sms-body" value={smsBody} onChange={(e) => setSmsBody(e.target.value)} onFocus={(e) => { lastFocusedRef.current = e.target; }} className="min-h-[80px]" />
            {smsBody.length > 160 && (
              <p className="text-xs text-amber-600">SMS exceeds 160 character limit</p>
            )}
          </div>
        )}

        {/* Merge fields */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Available Merge Fields</Label>
          <div className="flex flex-wrap gap-1">
            {MERGE_FIELDS.map((field) => (
              <Badge key={field} variant="outline" className="cursor-pointer text-xs hover:bg-muted" onClick={() => insertMergeField(field)}>
                {field}
              </Badge>
            ))}
          </div>
        </div>

        <Button variant="outline" onClick={() => setShowPreview(true)}>Preview with Sample Data</Button>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(channel === 'email' || channel === 'both') && (
              <>
                <div><Label className="text-xs">Subject</Label><p className="text-sm">{fillPreview(subject)}</p></div>
                <div><Label className="text-xs">Email Body</Label><p className="text-sm whitespace-pre-wrap">{fillPreview(emailBody)}</p></div>
              </>
            )}
            {(channel === 'sms' || channel === 'both') && (
              <div><Label className="text-xs">SMS</Label><p className="text-sm">{fillPreview(smsBody)}</p></div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
