import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseApiGet = vi.fn();
const mockNavigate = vi.fn();
const mockDownloadCsv = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/api/reports-v2', () => ({
  downloadReportCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { useAuthStore } from '@/stores/authStore';
import TierPerformanceReport from '../TierPerformanceReport';

const mockResponse = {
  season_year: 2026,
  rows: [
    { tier: 'gold' as const, active_contracts: 10, season_revenue: 80000, avg_contract_value: 8000,
      total_occurrences: 130, skipped_visits: 5, service_completion_rate: 90, clients_retained_pct: 85 },
    { tier: 'silver' as const, active_contracts: 5, season_revenue: 30000, avg_contract_value: 6000,
      total_occurrences: 50, skipped_visits: 2, service_completion_rate: 85, clients_retained_pct: 70 },
    { tier: 'bronze' as const, active_contracts: 15, season_revenue: 45000, avg_contract_value: 3000,
      total_occurrences: 0, skipped_visits: 0, service_completion_rate: null, clients_retained_pct: 50 },
  ],
  totals: { active_contracts: 30, season_revenue: 155000 },
};

function loginAs(role: string) {
  useAuthStore.setState({
    accessToken: 'tok',
    user: { id: 'u', email: 'x@y.z', first_name: 'X', last_name: 'Y', tenant_id: 't', roles: [{ role, division_id: null }] },
  });
}

function renderPage() {
  return render(<MemoryRouter><TierPerformanceReport /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('TierPerformanceReport', () => {
  it('non-owner is redirected to /reports', async () => {
    loginAs('div_mgr');
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: false, error: null });
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/reports', { replace: true });
    });
  });

  it('owner sees the transposed metrics table', () => {
    loginAs('owner');
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    // Column headers
    expect(screen.getByRole('columnheader', { name: 'Gold' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Silver' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bronze' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();

    // Metric rows
    expect(screen.getByRole('cell', { name: 'Active Contracts' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Season Revenue' })).toBeInTheDocument();

    // Bronze service completion rate shows "—" (null)
    const cells = screen.getAllByRole('cell');
    const dashes = cells.filter((c) => c.textContent === '—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders formatted totals column', () => {
    loginAs('owner');
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    expect(screen.getByText('$155,000')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('CSV export uses year-stamped filename', async () => {
    loginAs('owner');
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    const btn = screen.getByRole('button', { name: /export csv/i });
    btn.click();

    await waitFor(() => {
      expect(mockDownloadCsv).toHaveBeenCalledWith(
        '/v1/reports/tier-performance',
        expect.any(Object),
        expect.stringMatching(/^tier-performance-\d{4}\.csv$/),
      );
    });
  });
});
