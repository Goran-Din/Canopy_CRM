import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useApiGet } from '@/hooks/useApi';
import type { ContractDetail, WizardData } from '../SeasonSetupWizard';

interface ContractReviewStepProps {
  contract: ContractDetail;
  wizardData: WizardData;
  onChange: (data: Partial<WizardData>) => void;
}

interface BillingEntry {
  id: string;
  amount: string;
  status: string;
}

export function ContractReviewStep({ contract, wizardData, onChange }: ContractReviewStepProps) {
  const prevYear = wizardData.season_year - 1;
  const { data: prevBilling = [] } = useApiGet<BillingEntry[]>(
    ['billing-prev', contract.id, String(prevYear)],
    '/v1/billing/schedule',
    { contract_id: contract.id, year: String(prevYear) },
  );

  const prevTotal = prevBilling.reduce((s, b) => s + parseFloat(b.amount || '0'), 0);
  const prevMonthly = prevBilling.length > 0 ? prevTotal / prevBilling.length : 0;
  const allPaid = prevBilling.length > 0 && prevBilling.every((b) => b.status === 'paid');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Step 1: Contract Review</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Contract:</span> {contract.title}</p>
          <p>
            <span className="text-muted-foreground">Customer:</span> {contract.customer_display_name}
            {contract.customer_code && ` (${contract.customer_code})`}
          </p>
          <p>
            <span className="text-muted-foreground">Property:</span> {contract.property_address}
            {contract.property_category && <Badge variant="outline" className="ml-2 text-xs">{contract.property_category}</Badge>}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Season Year</Label>
              <Input
                type="number"
                value={wizardData.season_year}
                onChange={(e) => {
                  const year = parseInt(e.target.value) || new Date().getFullYear();
                  onChange({
                    season_year: year,
                    season_start: `${year}-04-01`,
                    season_end: `${year}-11-30`,
                  });
                }}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Season Start</Label>
              <Input
                type="date"
                value={wizardData.season_start}
                onChange={(e) => onChange({ season_start: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Season End</Label>
              <Input
                type="date"
                value={wizardData.season_end}
                onChange={(e) => onChange({ season_end: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last season summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Last Season Summary ({prevYear})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prevBilling.length > 0 ? (
            <p className="text-sm">
              {prevBilling.length} invoices &middot; ${prevMonthly.toFixed(2)}/mo &middot; Total: ${prevTotal.toFixed(2)}
              {allPaid && <span className="text-green-600 ml-2">All paid</span>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">First season for this contract</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-1">
        <Label>Notes for this season</Label>
        <Textarea
          value={wizardData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Any special notes for this season..."
          className="min-h-[80px]"
        />
      </div>
    </div>
  );
}
