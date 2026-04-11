import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((label, idx) => {
        const step = idx + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-0">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2',
                isCompleted && 'bg-green-500 border-green-500 text-white',
                isCurrent && 'bg-primary border-primary text-primary-foreground',
                !isCompleted && !isCurrent && 'bg-background border-gray-300 text-gray-400',
              )}>
                {step}
              </div>
              <span className={cn(
                'text-xs mt-1 hidden sm:block',
                isCurrent && 'font-bold text-primary',
                isCompleted && 'text-green-600',
                !isCompleted && !isCurrent && 'text-muted-foreground',
              )}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2',
                step < currentStep ? 'bg-green-500' : 'bg-gray-200 border-dashed',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
