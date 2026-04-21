/**
 * R-GPS-01 — Property Visit History standalone page.
 *
 * Thin shell around PropertyVisitHistoryView. User picks a property via a
 * UUID input (a full autocomplete picker can replace this in a future brief);
 * the view does the rest.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ReportHeader } from './_components/ReportHeader';
import { PropertyVisitHistoryView } from './PropertyVisitHistoryView';

export default function PropertyVisitHistoryReport() {
  const [propertyId, setPropertyId] = useState<string>('');
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    propertyId.trim(),
  );

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Property Visit History"
        description="GPS-verified visits per property (Layer 2 data)"
      />

      <div className="flex items-center gap-3">
        <Input
          placeholder="Property UUID"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-96 font-mono text-sm"
          aria-label="Property id"
        />
      </div>

      {isValidUuid ? (
        <PropertyVisitHistoryView propertyId={propertyId.trim()} />
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Enter a property UUID above to view its GPS visit history.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
