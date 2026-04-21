import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadReportCsv } from '@/api/reports-v2';

interface CsvExportButtonProps {
  endpoint: string;
  params: Record<string, unknown>;
  filename: string;
  disabled?: boolean;
}

export function CsvExportButton({ endpoint, params, filename, disabled }: CsvExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await downloadReportCsv(endpoint, params, filename);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || busy}
      aria-label="Export CSV"
    >
      <Download className="h-4 w-4 mr-2" />
      {busy ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}
