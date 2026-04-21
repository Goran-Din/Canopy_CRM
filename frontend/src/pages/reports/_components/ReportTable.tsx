import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ReportTableProps {
  loading?: boolean;
  error?: { message: string } | null;
  empty?: boolean;
  emptyMessage?: string;
  errorPrefix?: string;
  skeletonClassName?: string;
  children?: ReactNode;
}

/**
 * Card wrapper that handles the four standard states a report body can be in:
 *   - loading → tall Skeleton
 *   - error   → red card with the error message
 *   - empty   → centered muted text
 *   - ready   → children (typically a <Table>)
 *
 * DOM shape for each state matches the in-line pattern used by Batch-1 and
 * Batch-A pages so behavior tests (getByText on empty/error text, queries
 * for .animate-pulse, etc.) keep passing unchanged.
 */
export function ReportTable({
  loading,
  error,
  empty,
  emptyMessage = 'No results.',
  errorPrefix = 'Failed to load',
  skeletonClassName = 'h-64',
  children,
}: ReportTableProps) {
  if (loading) {
    return <Skeleton className={skeletonClassName} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-red-600">
          {errorPrefix}: {error.message}
        </CardContent>
      </Card>
    );
  }

  if (empty) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}
