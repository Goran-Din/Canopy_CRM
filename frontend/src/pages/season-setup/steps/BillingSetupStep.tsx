import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ContractDetail, WizardData } from '../SeasonSetupWizard';

interface BillingSetupStepProps {
  contract: ContractDetail;
  wizardData: WizardData;
  onChange: (data: Partial<WizardData>) => void;
}

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BillingSetupStep({ contract, wizardData, onChange }: BillingSetupStepProps) {
  const lastPrice = contract.previous_season_price;
  const suggestedPrice = lastPrice ? parseFloat((lastPrice * 1.035).toFixed(2)) : null;
  const price = wizardData.monthly_price;
  const months = wizardData.billing_months;
  const seasonTotal = (price || 0) * months;

  // Generate billing calendar rows
  const billingRows = useMemo(() => {
    const start = new Date(wizardData.season_start);
    const rows = [];
    for (let i = 0; i < months; i++) {
      const periodStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const periodEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 0);
      rows.push({
        num: i + 1,
        period: `${MONTH_NAMES[periodStart.getMonth()]} ${periodStart.getDate()} – ${MONTH_NAMES[periodEnd.getMonth()]} ${periodEnd.getDate()}`,
        billingDate: periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: price || 0,
      });
    }
    return rows;
  }, [wizardData.season_start, months, price]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Step 3: Billing Setup</h2>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Monthly Price for {wizardData.season_year} Season</Label>
            <div className="flex items-center gap-2">
              <span className="text-lg">$</span>
              <Input
                type="number"
                value={price !== null ? String(price) : ''}
                onChange={(e) => onChange({ monthly_price: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Enter monthly price"
                className="w-40 text-lg"
                min={0}
                step="any"
              />
              <span className="text-sm text-muted-foreground">per month</span>
            </div>
          </div>

          {lastPrice && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">
                Last season: {fmt(lastPrice)} &middot; Suggested (+3.5%): {fmt(suggestedPrice!)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ monthly_price: suggestedPrice! })}
              >
                Use {fmt(suggestedPrice!)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Billing Calendar — {months} invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">#</th>
                  <th className="text-left py-2 font-medium">Period</th>
                  <th className="text-left py-2 font-medium">Billing Date</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {billingRows.map((row) => (
                  <tr key={row.num} className="border-b last:border-0">
                    <td className="py-2">{row.num}</td>
                    <td className="py-2">{row.period}</td>
                    <td className="py-2">{row.billingDate}</td>
                    <td className="py-2 text-right font-medium">{fmt(row.amount)}</td>
                    <td className="py-2"><Badge variant="outline" className="text-xs">Scheduled</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4 border-t mt-2">
            <p className="text-lg font-bold">Season Total: {fmt(seasonTotal)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
