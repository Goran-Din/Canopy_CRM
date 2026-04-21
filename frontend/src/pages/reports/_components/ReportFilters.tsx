import type { ReactNode } from 'react';

interface ReportFiltersProps {
  /** Filter controls (Inputs, Selects). Rendered left-aligned. */
  children: ReactNode;
  /** Right-aligned actions, typically <CsvExportButton /> plus row-selection buttons. */
  actions?: ReactNode;
}

/**
 * Horizontal filter bar: wraps filter controls on the left and optional
 * actions (CSV export, bulk-assign) on the right via ml-auto.
 *
 * Intentionally minimal: we don't prescribe which controls to render,
 * because filter needs vary per report.
 */
export function ReportFilters({ children, actions }: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {actions ? <div className="ml-auto flex gap-2">{actions}</div> : null}
    </div>
  );
}
