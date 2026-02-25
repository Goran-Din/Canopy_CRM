import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  // Generic
  active: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',

  // Customers
  lead: 'bg-purple-100 text-purple-800 border-purple-200',
  prospect: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  suspended: 'bg-orange-100 text-orange-800 border-orange-200',

  // Contracts
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  signed: 'bg-green-100 text-green-800 border-green-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',

  // Jobs
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-200',
  on_hold: 'bg-orange-100 text-orange-800 border-orange-200',

  // Invoices
  paid: 'bg-green-100 text-green-800 border-green-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
  partially_paid: 'bg-amber-100 text-amber-800 border-amber-200',
  void: 'bg-gray-100 text-gray-800 border-gray-200',

  // Equipment
  available: 'bg-green-100 text-green-800 border-green-200',
  in_use: 'bg-blue-100 text-blue-800 border-blue-200',
  maintenance: 'bg-orange-100 text-orange-800 border-orange-200',
  retired: 'bg-gray-100 text-gray-800 border-gray-200',

  // Prospects
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  qualified: 'bg-purple-100 text-purple-800 border-purple-200',
  proposal: 'bg-amber-100 text-amber-800 border-amber-200',
  won: 'bg-green-100 text-green-800 border-green-200',
  lost: 'bg-red-100 text-red-800 border-red-200',
};

function formatLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = statusColors[status] ?? 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <Badge variant="outline" className={cn(colors, 'font-medium', className)}>
      {formatLabel(status)}
    </Badge>
  );
}
