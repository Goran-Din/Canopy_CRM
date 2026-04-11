import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

const MERGE_FIELDS = [
  '{{client_first_name}}', '{{client_last_name}}', '{{job_number}}',
  '{{signing_link}}', '{{valid_until}}', '{{property_address}}',
  '{{company_phone}}', '{{company_email}}', '{{company_name}}', '{{scheduled_date}}',
];

const TIMING_OPTIONS: Record<string, { value: string; label: string }[]> = {
  booking_confirmation: [{ value: 'immediately', label: 'Immediately' }],
  appointment_reminder: [{ value: '24h_before', label: '24h before' }, { value: '48h_before', label: '48h before' }],
  quote_follow_up: [{ value: '3_days', label: '3 days' }, { value: '5_days', label: '5 days' }, { value: '7_days', label: '7 days' }],
  payment_reminder: [{ value: '1_day_after', label: '1 day after' }, { value: '3_days_after', label: '3 days after' }],
  feedback_request: [{ value: '1_day_after', label: '1 day after' }, { value: '2_days_after', label: '2 days after' }, { value: '3_days_after', label: '3 days after' }],
};

interface AutomationConfigPanelProps {
  automation: {
    type: string;
    enabled: boolean;
    channel: string;
    timing: string;
    config: Record<string, unknown>;
  };
  info: { name: string; trigger: string };
  onClose: () => void;
}

export function AutomationConfigPanel({ automation, info, onClose }: AutomationConfigPanelProps) {
  const [enabled, setEnabled] = useState(automation.enabled);
  const [channel, setChannel] = useState(automation.channel || 'both');
  const [timing, setTiming] = useState(automation.timing || TIMING_OPTIONS[automation.type]?.[0]?.value || 'immediately');
  const [subject, setSubject] = useState((automation.config.subject as string) || '');
  const [emailBody, setEmailBody] = useState((automation.config.email_body as string) || '');
  const [smsBody, setSmsBody] = useState((automation.config.sms_body as string) || '');
  const lastFocusedRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const patchConfig = useApiMutation<void, Record<string, unknown>>(
    'patch', `/v1/templates/automations/${automation.type}/config`, [['automations']],
  );

  const insertMergeField = (field: string) => {
    const el = lastFocusedRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const newVal = el.value.substring(0, start) + field + el.value.substring(end);
    if (el === document.querySelector('[data-field="auto-subject"]')) setSubject(newVal);
    else if (el === document.querySelector('[data-field="auto-email"]')) setEmailBody(newVal);
    else if (el === document.querySelector('[data-field="auto-sms"]')) setSmsBody(newVal);
  };

  const handleSave = async () => {
    try {
      await patchConfig.mutateAsync({ enabled, channel, timing, config: { subject, email_body: emailBody, sms_body: smsBody } });
      toast.success('Configuration saved');
      onClose();
    } catch { toast.error('Failed to save.'); }
  };

  const timingOptions = TIMING_OPTIONS[automation.type] || [];

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Configure: {info.name}</h3>
        <div className="flex gap-2">
          <Button onClick={handleSave}>Save</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label>Enabled</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-1">
          <Label>Send via</Label>
          <div className="flex gap-4">
            {(['both', 'sms', 'email'] as const).map((ch) => (
              <label key={ch} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="auto-channel" value={ch} checked={channel === ch} onChange={() => setChannel(ch)} className="accent-primary" />
                {ch === 'both' ? 'SMS + Email' : ch === 'sms' ? 'SMS only' : 'Email only'}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Timing</Label>
          <Select value={timing} onValueChange={setTiming}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {timingOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {/* Message template */}
        {(channel === 'email' || channel === 'both') && (
          <>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input data-field="auto-subject" value={subject} onChange={(e) => setSubject(e.target.value)} onFocus={(e) => { lastFocusedRef.current = e.target; }} />
            </div>
            <div className="space-y-1">
              <Label>Email Body</Label>
              <Textarea data-field="auto-email" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} onFocus={(e) => { lastFocusedRef.current = e.target; }} className="min-h-[100px]" />
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
            <Textarea data-field="auto-sms" value={smsBody} onChange={(e) => setSmsBody(e.target.value)} onFocus={(e) => { lastFocusedRef.current = e.target; }} className="min-h-[80px]" />
            {smsBody.length > 160 && <p className="text-xs text-amber-600">SMS exceeds 160 character limit</p>}
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Merge Fields</Label>
          <div className="flex flex-wrap gap-1">
            {MERGE_FIELDS.map((f) => (
              <Badge key={f} variant="outline" className="cursor-pointer text-xs hover:bg-muted" onClick={() => insertMergeField(f)}>
                {f}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
