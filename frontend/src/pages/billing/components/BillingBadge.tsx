import { cn } from '@/lib/utils';

interface BillingBadgeProps { count: number; variant?: 'default' | 'warning' | 'danger'; }

export function BillingBadge({ count, variant = 'default' }: BillingBadgeProps) {
  return (
    <span className={cn(
      'ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full',
      variant === 'danger' && 'bg-red-100 text-red-700',
      variant === 'warning' && 'bg-amber-100 text-amber-700',
      variant === 'default' && 'bg-muted text-muted-foreground',
    )}>
      {count}
    </span>
  );
}
