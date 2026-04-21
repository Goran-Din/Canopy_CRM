import { Outlet } from 'react-router-dom';

/**
 * Thin layout for /reports and all its sub-routes.
 *
 * Each child page renders its own header + filter bar. The hub (ReportsHome)
 * provides navigation to sub-reports via links; this layout is intentionally
 * bare so sub-pages can control their own space.
 */
export default function ReportsLayout() {
  return <Outlet />;
}
