import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface KpiItem {
  label: string;
  value: string | number;
  /** Optional Tailwind class(es) applied to the value, e.g. "text-red-600". */
  accent?: string;
}

interface KpiStripProps {
  items: KpiItem[];
  columns?: 3 | 4 | 5 | 6;
  loading?: boolean;
}

const gridColsClass: Record<NonNullable<KpiStripProps['columns']>, string> = {
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

/**
 * Horizontal strip of KPI cards. DOM shape preserved from the in-line
 * implementations used by Batch-1 and Batch-A pages:
 *   <Card><CardContent><p>{label}</p><p className="{accent}">{value}</p></CardContent></Card>
 *
 * Tests that assert on label text or raw value text continue to match.
 */
export function KpiStrip({ items, columns = 4, loading }: KpiStripProps) {
  return (
    <div className={cn('grid gap-4', gridColsClass[columns])}>
      {loading
        ? Array.from({ length: items.length || columns }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))
        : items.map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={cn('text-2xl font-bold', item.accent)}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
