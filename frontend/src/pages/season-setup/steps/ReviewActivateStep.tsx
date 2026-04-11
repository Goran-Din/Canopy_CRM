import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import type { ContractDetail, WizardData } from '../SeasonSetupWizard';

interface ReviewActivateStepProps {
  contract: ContractDetail;
  wizardData: WizardData;
  onActivate: () => void;
  isActivating: boolean;
}

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

export function ReviewActivateStep({ contract, wizardData }: ReviewActivateStepProps) {
  const nonWeeklyServices = wizardData.services.filter((s) => s.service_type !== 'weekly');
  const totalOccurrences = nonWeeklyServices.reduce((sum, s) => sum + s.occurrence_count, 0);
  const seasonTotal = (wizardData.monthly_price || 0) * wizardData.billing_months;

  // First billing date
  const firstDate = new Date(wizardData.season_start).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Step 4: Review & Activate</h2>

      {/* Season summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Season Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Contract:</span> {contract.title} &middot; {contract.customer_display_name} &middot; {contract.property_address}</p>
          <p><span className="text-muted-foreground">Season:</span> {wizardData.season_start} – {wizardData.season_end}</p>
          {wizardData.notes && <p><span className="text-muted-foreground">Notes:</span> {wizardData.notes}</p>}
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Services ({totalOccurrences} occurrences)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {nonWeeklyServices.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {s.service_name} &times; {s.occurrence_count}
              </Badge>
            ))}
          </div>
          {wizardData.services.some((s) => s.service_type === 'weekly') && (
            <p className="text-xs text-muted-foreground mt-2">+ Weekly services managed by recurring job system</p>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Billing ({wizardData.billing_months} invoices)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            {fmt(wizardData.monthly_price || 0)} &times; {wizardData.billing_months} months = <span className="font-bold">{fmt(seasonTotal)}</span>
          </p>
          <p><span className="text-muted-foreground">First invoice:</span> {firstDate}</p>
        </CardContent>
      </Card>

      {/* Ready message */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-md">
        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-800">Ready to activate.</p>
          <p className="text-xs text-green-700 mt-1">This action can be undone by contacting Goran / North 37 support.</p>
        </div>
      </div>
    </div>
  );
}
