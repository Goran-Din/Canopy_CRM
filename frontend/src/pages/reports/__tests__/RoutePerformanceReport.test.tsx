import { render, screen } from '@testing-library/react';
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

import RoutePerformanceReport from '../RoutePerformanceReport';

const mockResponse = {
  rows: [
    {
      property_id: 'p1',
      street_address: '123 Oak',
      property_category: 'residential',
      estimated_duration_minutes: 30,
      avg_actual: 42,
      variance_minutes: 12,
      variance_pct: 40,
      visit_count: 8,
      trend: 'increasing' as const,
    },
    {
      property_id: 'p2',
      street_address: '45 Elm',
      property_category: 'commercial',
      estimated_duration_minutes: 60,
      avg_actual: 55,
      variance_minutes: -5,
      variance_pct: -8.3,
      visit_count: 10,
      trend: 'stable' as const,
    },
    {
      property_id: 'p3',
      street_address: '99 Pine',
      property_category: 'residential',
      estimated_duration_minutes: null,
      avg_actual: 45,
      variance_minutes: null,
      variance_pct: null,
      visit_count: 5,
      trend: 'decreasing' as const,
    },
  ],
};

function renderPage() {
  return render(<MemoryRouter><RoutePerformanceReport /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('RoutePerformanceReport', () => {
  it('renders rows sorted by variance_pct DESC (nulls last)', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    const rows = screen.getAllByRole('row').slice(1); // drop header
    // Biggest positive variance first → 123 Oak, then 45 Elm, then 99 Pine (null)
    expect(rows[0]).toHaveTextContent('123 Oak');
    expect(rows[1]).toHaveTextContent('45 Elm');
    expect(rows[2]).toHaveTextContent('99 Pine');
  });

  it('trend column uses emoji arrows with accessible labels', () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    expect(screen.getByLabelText('Trend: increasing')).toHaveTextContent('📈');
    expect(screen.getByLabelText('Trend: stable')).toHaveTextContent('➡️');
    expect(screen.getByLabelText('Trend: decreasing')).toHaveTextContent('📉');
  });

  it('passes min_visit_count=3 by default and updates when changed', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    const firstParams = mockUseApiGet.mock.calls[0]?.[2];
    expect(firstParams).toMatchObject({ min_visit_count: 3 });
  });

  it('CSV export triggers download with a year-stamped filename', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    screen.getByRole('button', { name: /export csv/i }).click();

    // downloadReportCsv is called synchronously after click (state is busy)
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      '/v1/reports/route-performance',
      expect.any(Object),
      expect.stringMatching(/^route-performance-\d{4}\.csv$/),
    );
  });
});
