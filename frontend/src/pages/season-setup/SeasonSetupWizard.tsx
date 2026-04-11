import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { StepIndicator } from './components/StepIndicator';
import { ContractReviewStep } from './steps/ContractReviewStep';
import { ServiceConfigStep } from './steps/ServiceConfigStep';
import { BillingSetupStep } from './steps/BillingSetupStep';
import { ReviewActivateStep } from './steps/ReviewActivateStep';

export interface ServiceConfig {
  service_code: string;
  service_name: string;
  service_type: string;
  occurrence_count: number;
  preferred_months: string[];
  xero_item_code: string | null;
}

export interface WizardData {
  season_year: number;
  season_start: string;
  season_end: string;
  notes: string;
  services: ServiceConfig[];
  monthly_price: number | null;
  billing_months: number;
}

export interface ContractDetail {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  customer_id: string;
  customer_display_name: string;
  customer_code: string;
  property_address: string;
  property_category: string | null;
  division: string;
  total_value: string;
  services: { service_code: string; service_name: string; service_type: string; xero_item_code: string | null }[];
  previous_season_price: number | null;
}

const STEPS = ['Contract', 'Services', 'Billing', 'Review'];
const STEP_NAMES = ['Services', 'Billing', 'Review & Activate'];

export default function SeasonSetupWizard() {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isActivating, setIsActivating] = useState(false);

  const currentYear = new Date().getFullYear();
  const [wizardData, setWizardData] = useState<WizardData>({
    season_year: currentYear,
    season_start: `${currentYear}-04-01`,
    season_end: `${currentYear}-11-30`,
    notes: '',
    services: [],
    monthly_price: null,
    billing_months: 8,
  });

  const { data: contract, isLoading } = useApiGet<ContractDetail>(
    ['contract', contractId],
    `/v1/contracts/${contractId}`,
    undefined,
    { enabled: !!contractId },
  );

  const activateMut = useApiMutation<{ occurrences_created: number; billing_entries_created: number }, WizardData>(
    'post',
    `/v1/contracts/${contractId}/season-setup`,
    [['contract', contractId]],
  );

  const updateData = (partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (new Date(wizardData.season_start) >= new Date(wizardData.season_end)) {
        toast.error('Season start must be before season end.');
        return;
      }
      // Calculate billing months
      const start = new Date(wizardData.season_start);
      const end = new Date(wizardData.season_end);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      updateData({ billing_months: months });
    }
    setCurrentStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const result = await activateMut.mutateAsync(wizardData);
      toast.success('Season activated successfully!');
      setTimeout(() => navigate(`/contracts/${contractId}`), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to activate season.';
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!contract) {
    return <p className="p-6 text-muted-foreground">Contract not found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Season Setup — {contract.customer_display_name} {contract.customer_code && `(${contract.customer_code})`}</h1>
        <p className="text-sm text-muted-foreground">{contract.title} — {contract.property_address} &middot; Season: {wizardData.season_year}</p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={currentStep} steps={STEPS} />

      {/* Step content */}
      {currentStep === 1 && <ContractReviewStep contract={contract} wizardData={wizardData} onChange={updateData} />}
      {currentStep === 2 && <ServiceConfigStep contract={contract} wizardData={wizardData} onChange={updateData} />}
      {currentStep === 3 && <BillingSetupStep contract={contract} wizardData={wizardData} onChange={updateData} />}
      {currentStep === 4 && <ReviewActivateStep contract={contract} wizardData={wizardData} onActivate={handleActivate} isActivating={isActivating} />}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        {currentStep > 1 ? (
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        ) : <div />}

        {currentStep < 4 ? (
          <Button onClick={handleNext}>
            Next: {STEP_NAMES[currentStep - 1]} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button className="bg-[#2E7D32] hover:bg-[#256429]" onClick={handleActivate} disabled={isActivating}>
            {isActivating ? 'Activating...' : <><Rocket className="h-4 w-4 mr-1" /> Activate Season</>}
          </Button>
        )}
      </div>
    </div>
  );
}
