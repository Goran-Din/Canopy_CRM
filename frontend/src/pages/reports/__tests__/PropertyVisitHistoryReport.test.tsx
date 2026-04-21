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

import PropertyVisitHistoryReport from '../PropertyVisitHistoryReport';

const VALID_UUID = '11111111-2222-3333-4444-555555555555';

const mockResponse = {
  property_id: VALID_UUID,
  summary: {
    total_visits: 2,
    verified_visits: 1,
    avg_time_on_site_minutes: 42,
    scheduled_estimate_minutes: 30,
    variance_minutes: 12,
  },
  rows: [
    {
      arrival_at: '2026-06-15T14:00:00Z',
      departure_at: '2026-06-15T14:45:00Z',
      time_on_site_minutes: 45,
      crew_member: 'John Smith',
      job_number: '0100-26',
      verification_status: 'verified' as const,
      distance_from_centre_at_departure: 12.5,
    },
    {
      arrival_at: '2026-06-20T10:00:00Z',
      departure_at: null,
      time_on_site_minutes: null,
      crew_member: 'Jane Doe',
      job_number: null,
      verification_status: 'unverified' as const,
      distance_from_centre_at_departure: null,
    },
  ],
};

function renderPage() {
  return render(<MemoryRouter><PropertyVisitHistoryReport /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PropertyVisitHistoryReport', () => {
  it('shows placeholder until a valid UUID is entered', () => {
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: false, error: null });
    renderPage();

    expect(screen.getByText(/enter a property uuid/i)).toBeInTheDocument();
  });

  it('renders summary + visit rows once a valid UUID is provided', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    await userEvent.type(screen.getByLabelText('Property id'), VALID_UUID);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    // Departure-less row shows "still on site"
    expect(screen.getByText(/still on site/i)).toBeInTheDocument();
    // Verification icons rendered with accessible labels
    expect(screen.getByLabelText('Verified')).toBeInTheDocument();
    expect(screen.getByLabelText('Unverified')).toBeInTheDocument();
  });

  it('CSV button triggers download once a UUID is entered', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null });
    renderPage();

    await userEvent.type(screen.getByLabelText('Property id'), VALID_UUID);
    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockDownloadCsv).toHaveBeenCalledWith(
      '/v1/reports/property-visit-history',
      expect.objectContaining({ property_id: VALID_UUID }),
      expect.stringContaining(VALID_UUID),
    );
  });
});
