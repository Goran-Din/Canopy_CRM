import { useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { apiClient } from '@/api/client';
import { ServiceRow } from '../components/ServiceRow';
import type { ContractDetail, WizardData, ServiceConfig } from '../SeasonSetupWizard';

interface ServiceConfigStepProps {
  contract: ContractDetail;
  wizardData: WizardData;
  onChange: (data: Partial<WizardData>) => void;
}

export function ServiceConfigStep({ contract, wizardData, onChange }: ServiceConfigStepProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ item_code: string; name: string }[]>([]);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  // Pre-populate from contract services on first render if empty
  if (wizardData.services.length === 0 && contract.services?.length > 0) {
    const services: ServiceConfig[] = contract.services.map((s) => ({
      service_code: s.service_code,
      service_name: s.service_name,
      service_type: s.service_type,
      occurrence_count: s.service_type === 'weekly' ? 0 : s.service_type === 'one_time' ? 1 : 3,
      preferred_months: [],
      xero_item_code: s.xero_item_code,
    }));
    onChange({ services });
  }

  const updateService = (idx: number, service: ServiceConfig) => {
    const next = [...wizardData.services];
    next[idx] = service;
    onChange({ services: next });
  };

  const removeService = (idx: number) => {
    onChange({ services: wizardData.services.filter((_, i) => i !== idx) });
    setRemoveTarget(null);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await apiClient.get('/v1/xero-items', { params: { search: query } });
      setSearchResults(Array.isArray(data) ? data.slice(0, 10) : (data.data || []).slice(0, 10));
    } catch { setSearchResults([]); }
  };

  const addService = (name: string, code: string | null) => {
    const newService: ServiceConfig = {
      service_code: code || name.toLowerCase().replace(/\s+/g, '_'),
      service_name: name,
      service_type: 'one_time',
      occurrence_count: 1,
      preferred_months: [],
      xero_item_code: code,
    };
    onChange({ services: [...wizardData.services, newService] });
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const hasWeekly = wizardData.services.some((s) => s.service_type === 'weekly');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Step 2: Service Configuration</h2>
        <p className="text-sm text-muted-foreground">{contract.title} services for this property this season.</p>
      </div>

      {/* Service rows */}
      <div className="border rounded-md">
        <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <span className="flex-1 min-w-[140px]">Service</span>
          <span className="w-16 text-center">Type</span>
          <span className="w-16 text-center">Count</span>
          <span className="min-w-[200px]">Preferred</span>
          <span className="w-7"></span>
        </div>
        {wizardData.services.map((service, idx) => (
          <ServiceRow
            key={`${service.service_code}-${idx}`}
            service={service}
            onUpdate={(s) => updateService(idx, s)}
            onRemove={() => {
              // Pre-populated services need confirmation
              if (contract.services?.some((cs) => cs.service_code === service.service_code)) {
                setRemoveTarget(idx);
              } else {
                removeService(idx);
              }
            }}
          />
        ))}
        {wizardData.services.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No services configured.</p>
        )}
      </div>

      <Button variant="outline" onClick={() => setSearchOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Add Service
      </Button>

      {hasWeekly && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800">Weekly services are managed by the recurring job system.</span>
        </div>
      )}

      {/* Add Service Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
          <Input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Search Xero items..." autoFocus />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {searchResults.map((item) => (
              <button key={item.item_code} className="w-full text-left px-3 py-2 hover:bg-muted rounded text-sm" onClick={() => addService(item.name, item.item_code)}>
                <span className="text-xs font-mono text-muted-foreground mr-2">{item.item_code}</span>
                {item.name}
              </button>
            ))}
            {searchQuery.length >= 2 && (
              <button className="w-full text-left px-3 py-2 hover:bg-muted rounded text-sm text-primary" onClick={() => addService(searchQuery, null)}>
                + Use custom: "{searchQuery}"
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove service?"
        description="This service is part of the contract package. Remove from this season?"
        onConfirm={() => removeTarget !== null && removeService(removeTarget)}
        variant="destructive"
      />
    </div>
  );
}
