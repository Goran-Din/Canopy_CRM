import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { AutomationConfigPanel } from './AutomationConfigPanel';

interface AutomationConfig {
  type: string;
  enabled: boolean;
  channel: string;
  timing: string;
  last_fired_at: string | null;
  last_fired_job: string | null;
  config: Record<string, unknown>;
}

const AUTOMATION_INFO: Record<string, { name: string; trigger: string }> = {
  booking_confirmation: { name: 'Booking Confirmation', trigger: 'Job scheduled with crew assigned' },
  appointment_reminder: { name: 'Appointment Reminder', trigger: '24 hours before scheduled job' },
  quote_follow_up: { name: 'Quote Follow-Up', trigger: 'Quote sent, no response in N days' },
  payment_reminder: { name: 'Payment Reminder', trigger: 'Invoice past due date' },
  feedback_request: { name: 'Feedback Request', trigger: 'Invoice paid' },
};

export function AutomationList() {
  const [configuringType, setConfiguringType] = useState<string | null>(null);

  const { data: automations = [], refetch } = useApiGet<AutomationConfig[]>(
    ['automations'], '/v1/templates/automations',
  );

  const toggleMut = useApiMutation<void, Record<string, unknown>>(
    'patch',
    (vars) => `/v1/templates/automations/${vars._type}/config`,
    [['automations']],
  );

  const handleToggle = async (auto: AutomationConfig) => {
    await toggleMut.mutateAsync({ _type: auto.type, enabled: !auto.enabled });
    const info = AUTOMATION_INFO[auto.type];
    toast.success(`${info?.name || auto.type} ${auto.enabled ? 'disabled' : 'enabled'}`);
    refetch();
  };

  if (configuringType) {
    const auto = automations.find((a) => a.type === configuringType);
    if (auto) {
      return <AutomationConfigPanel automation={auto} info={AUTOMATION_INFO[auto.type]} onClose={() => { setConfiguringType(null); refetch(); }} />;
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="font-semibold">Automations</h3>
        <p className="text-sm text-muted-foreground">All automations are OFF by default. Enable each one.</p>
      </div>

      <div className="space-y-3">
        {Object.entries(AUTOMATION_INFO).map(([type, info]) => {
          const auto = automations.find((a) => a.type === type);
          return (
            <Card key={type}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{info.name}</span>
                      {auto?.enabled && <Badge className="text-xs bg-green-100 text-green-800">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Fires when: {info.trigger}</p>
                    {auto && (
                      <p className="text-xs text-muted-foreground">
                        Send via: {auto.channel === 'both' ? 'SMS + Email' : auto.channel === 'sms' ? 'SMS' : 'Email'}
                        {' | '}Timing: {auto.timing || 'Immediately'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Last fired: {auto?.last_fired_at
                        ? `${new Date(auto.last_fired_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${auto.last_fired_job ? ` (Job #${auto.last_fired_job})` : ''}`
                        : 'Never'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={auto?.enabled ?? false} onCheckedChange={() => auto && handleToggle(auto)} />
                    <Button variant="outline" size="sm" onClick={() => setConfiguringType(type)}>Configure</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
