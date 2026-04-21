import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseApiGet = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
}));

const mockDownloadCsv = vi.fn().mockResolvedValue(undefined);
vi.mock('@/api/reports-v2', () => ({
  downloadReportCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));

vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import SeasonCompletionReport from '../SeasonCompletionReport';

const mockResponse = {
  season_year: 2026,
  totals: { total: 140, done: 100, assigned: 20, pending: 15, skipped: 5, completion_rate: 85.7 },
  rows: [
    { service_code: 'FERT', service_name: 'Fertilization', per_season: 5, total: 100,
      done: 60, assigned: 20, pending: 15, skipped: 5, completion_rate: 80, is_complete: false },
    { service_code: 'AERATE', service_name: 'Core Aeration', per_season: 1, total: 40,
      done: 40, assigned: 0, pending: 0, skipped: 0, completion_rate: 100, is_complete: true },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SeasonCompletionReport />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SeasonCompletionReport', () => {
  it('renders KPI strip and service rows from API response', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    expect(screen.getByRole('heading', { name: /season completion/i })).toBeInTheDocument();

    // KPI totals
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('85.7%')).toBeInTheDocument();

    // Rows
    expect(screen.getByText('Fertilization')).toBeInTheDocument();
    expect(screen.getByText('Core Aeration')).toBeInTheDocument();
  });

  it('renders ✅ icon only for complete services', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    // AERATE is complete → has the check icon with aria-label
    const completeIcons = screen.getAllByLabelText('Complete');
    expect(completeIcons).toHaveLength(1);

    // Find the row with AERATE and confirm the check is within it
    const aerateCell = screen.getByText('Core Aeration');
    const aerateRow = aerateCell.closest('tr')!;
    expect(within(aerateRow).getByLabelText('Complete')).toBeInTheDocument();
  });

  it('shows skeleton while loading', () => {
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = renderPage();

    // shadcn Skeleton renders an animated div; count the skeleton divs
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no rows', () => {
    mockUseApiGet.mockReturnValue({
      data: { season_year: 2099, totals: { total: 0, done: 0, assigned: 0, pending: 0, skipped: 0, completion_rate: 0 }, rows: [] },
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(screen.getByText(/no occurrences scheduled/i)).toBeInTheDocument();
  });

  it('shows error state when useApiGet returns an error', () => {
    mockUseApiGet.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Server blew up' },
    });
    renderPage();

    expect(screen.getByText(/server blew up/i)).toBeInTheDocument();
  });

  it('passes season_year to useApiGet and refetches when changed', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    // Initial call used current year
    const currentYear = new Date().getFullYear();
    const [firstKey, firstUrl, firstParams] = mockUseApiGet.mock.calls[0];
    expect(firstKey).toContain(currentYear);
    expect(firstUrl).toBe('/v1/reports/season-completion');
    expect(firstParams).toMatchObject({ season_year: currentYear });

    // Change year
    const yearInput = screen.getByLabelText('Season year');
    await userEvent.clear(yearInput);
    await userEvent.type(yearInput, '2027');

    // useApiGet called again with new year in the params
    const lastCallParams = mockUseApiGet.mock.calls.at(-1)?.[2];
    expect(lastCallParams).toMatchObject({ season_year: 2027 });
  });

  it('CSV export button triggers downloadReportCsv', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    const button = screen.getByRole('button', { name: /export csv/i });
    await userEvent.click(button);

    expect(mockDownloadCsv).toHaveBeenCalledWith(
      '/v1/reports/season-completion',
      expect.objectContaining({ season_year: new Date().getFullYear() }),
      expect.stringMatching(/^season-completion-\d{4}\.csv$/),
    );
  });
});
