import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ServiceConfig } from '../SeasonSetupWizard';

const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'];
const TYPE_COLORS: Record<string, string> = {
  weekly: 'bg-gray-100 text-gray-800',
  seasonal: 'bg-blue-100 text-blue-800',
  one_time: 'bg-teal-100 text-teal-800',
};

interface ServiceRowProps {
  service: ServiceConfig;
  onUpdate: (service: ServiceConfig) => void;
  onRemove: () => void;
}

export function ServiceRow({ service, onUpdate, onRemove }: ServiceRowProps) {
  const isWeekly = service.service_type === 'weekly';
  const isOneTime = service.service_type === 'one_time';

  const handleCountChange = (count: string) => {
    const n = parseInt(count);
    const months = service.preferred_months.slice(0, n);
    while (months.length < n) months.push('');
    onUpdate({ ...service, occurrence_count: n, preferred_months: months });
  };

  const handleMonthChange = (idx: number, month: string) => {
    const months = [...service.preferred_months];
    months[idx] = month;
    onUpdate({ ...service, preferred_months: months });
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <span className="text-sm font-medium flex-1 min-w-[140px]">{service.service_name}</span>
      <Badge className={`text-xs ${TYPE_COLORS[service.service_type] || ''}`}>
        {service.service_type.replace('_', ' ')}
      </Badge>

      {/* Count */}
      <div className="w-16 text-center">
        {isWeekly ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : isOneTime ? (
          <span className="text-sm">1</span>
        ) : (
          <Select value={String(service.occurrence_count)} onValueChange={handleCountChange}>
            <SelectTrigger className="h-8 text-sm w-16"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Preferred months */}
      <div className="flex gap-1 flex-wrap min-w-[200px]">
        {isWeekly ? (
          <span className="text-xs text-muted-foreground">(auto-scheduled)</span>
        ) : (
          Array.from({ length: isOneTime ? 1 : service.occurrence_count }, (_, i) => (
            <Select key={i} value={service.preferred_months[i] || ''} onValueChange={(m) => handleMonthChange(i, m)}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          ))
        )}
      </div>

      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRemove}>
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
