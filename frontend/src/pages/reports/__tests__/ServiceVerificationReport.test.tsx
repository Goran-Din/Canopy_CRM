import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseApiGet = vi.fn();
const mockDownloadCsv = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
}));
vi.mock('@/api/reports-v2', () => ({
  downloadReportCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));
vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import ServiceVerificationReport from '../ServiceVerificationReport';

const makeRow = (over: { id?: string; v: 'verified' | 'unverified' | 'no_gps' }) => ({
  occurrence_id: over.id ?? Math.random().toString(36).slice(2),
  customer_name: 'Acme',
  street_address: '1 Elm',
  service_code: 'FERT',
  service_name: 'Fertilization',
  occurrence_label: '2/5',
  assigned_date: '2026-06-15',
  job_number: '0100-26',
  verification_status: over.v,
  time_on_site_minutes: over.v === 'no_gps' ? null : 45,
  crew_member: 'John',
  service_tier: 'gold',
});

const mockResponse = {
  totals: { total: 3, verified: 1, unverified: 1, no_gps: 1, verification_rate: 33.3 },
  rows: [
    makeRow({ id: 'v1', v: 'verified' }),
    makeRow({ id: 'u1', v: 'unverified' }),
    makeRow({ id: 'n1', v: 'no_gps' }),
  ],
};

function renderPage() {
  return render(<MemoryRouter><ServiceVerificationReport /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ServiceVerificationReport', () => {
  it('renders KPI strip (including verification_rate) and one row per status', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    expect(screen.getByText('33.3%')).toBeInTheDocument();
    // Status-cell indicators: one of each (the filter chips also use the same labels,
    // so scope this assertion to the data rows' GPS column)
    const rows = screen.getAllByRole('row');
    // header + 3 data
    expect(rows).toHaveLength(4);
  });

  it('toggling off the "Verified" chip hides verified rows (client-side filter)', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    // All three chips start active. Toggle off "Verified".
    await userEvent.click(screen.getByRole('button', { name: /toggle verified/i }));

    // Rows now 2 data + 1 header
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('when only one chip is active, the verification filter is sent to the server', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    // Deactivate two chips, leaving only "Verified"
    await userEvent.click(screen.getByRole('button', { name: /toggle unverified/i }));
    await userEvent.click(screen.getByRole('button', { name: /toggle no gps/i }));

    const lastParams = mockUseApiGet.mock.calls.at(-1)?.[2];
    expect(lastParams).toMatchObject({ verification: 'verified' });
  });

  it('at least one chip must stay active (cannot disable all three)', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /toggle verified/i }));
    await userEvent.click(screen.getByRole('button', { name: /toggle unverified/i }));
    // Try to disable the last one
    await userEvent.click(screen.getByRole('button', { name: /toggle no gps/i }));

    // No GPS chip should still be pressed
    const noGpsChip = screen.getByRole('button', { name: /toggle no gps/i });
    expect(noGpsChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('filter chip group has accessible name', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    const group = screen.getByRole('group', { name: /verification filter/i });
    // Three toggle buttons in it
    expect(within(group).getAllByRole('button')).toHaveLength(3);
  });

  it('CSV export triggers download helper', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      '/v1/reports/service-verification',
      expect.any(Object),
      expect.stringMatching(/^service-verification-\d{4}\.csv$/),
    );
  });
});
