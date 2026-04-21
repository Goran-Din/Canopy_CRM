import { render, screen } from '@testing-library/react';
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

import SkippedVisitsReport from '../SkippedVisitsReport';

const mockResponse = {
  totals: {
    total: 3,
    recovered: 1,
    unrecovered: 2,
    by_reason: { rain: 2, client_request: 1 },
  },
  rows: [
    {
      id: '1',
      skipped_date: '2026-06-10',
      skipped_reason: 'rain',
      recovery_date: '2026-06-12',
      occurrence_label: '2',
      service_name: 'Mowing',
      customer_name: 'Acme',
      customer_number: 'SS-0042',
      property: '123 Elm',
      service_tier: 'bronze',
      billing_impact: 'Recovered',
    },
  ],
};

function renderPage() {
  return render(<MemoryRouter><SkippedVisitsReport /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SkippedVisitsReport', () => {
  it('renders KPIs + reason breakdown + rows', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    // KPI total count
    expect(screen.getByText('3')).toBeInTheDocument();

    // Reason breakdown (progress bars with aria labels)
    expect(screen.getByLabelText('rain count')).toBeInTheDocument();
    expect(screen.getByLabelText('client_request count')).toBeInTheDocument();

    // Table row
    expect(screen.getByText('Acme')).toBeInTheDocument();
    // "Recovered" appears both as a KPI label and as the row's billing_impact
    // badge — use getAllByText here to avoid false ambiguity failures.
    expect(screen.getAllByText('Recovered').length).toBeGreaterThan(0);
  });

  it('date-range filter passes through to useApiGet params', async () => {
    // We exercise from_date rather than the Radix Select (which has a known
    // hasPointerCapture issue under jsdom). The code path for all filters is
    // identical — building the params memo — so one input change is sufficient.
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    await userEvent.type(screen.getByLabelText('From date'), '2026-04-01');

    const lastParams = mockUseApiGet.mock.calls.at(-1)?.[2];
    expect(lastParams).toMatchObject({ from_date: '2026-04-01' });
  });

  it('CSV export uses year-stamped filename', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockDownloadCsv).toHaveBeenCalledWith(
      '/v1/reports/skipped-visits',
      expect.any(Object),
      expect.stringMatching(/^skipped-visits-\d{4}\.csv$/),
    );
  });
});
