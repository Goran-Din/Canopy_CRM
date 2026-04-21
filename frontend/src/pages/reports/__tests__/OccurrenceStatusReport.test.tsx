import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseApiGet = vi.fn();
const mockDownloadCsv = vi.fn().mockResolvedValue(undefined);
const mockBulkAssign = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
}));
vi.mock('@/api/reports-v2', () => ({
  downloadReportCsv: (...args: unknown[]) => mockDownloadCsv(...args),
  bulkAssignOccurrences: (...args: unknown[]) => mockBulkAssign(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import OccurrenceStatusReport from '../OccurrenceStatusReport';

const mockResponse = {
  service_code: 'FERT',
  service_name: 'Fertilization',
  preferred_month: 'June',
  totals: { pending: 2, assigned: 5, completed: 10, skipped: 1 },
  rows: [
    {
      occurrence_id: '11111111-1111-1111-1111-111111111111',
      service_code: 'FERT',
      service_name: 'Fertilization',
      occurrence_number: 2,
      status: 'assigned' as const,
      assigned_date: '2026-06-15',
      preferred_month: 'June',
      customer_id: 'c1',
      customer_name: 'Acme Co',
      customer_number: 'SS-0042',
      property_id: 'p1',
      street_address: '123 Elm St',
      city: 'Toronto',
      property_category: 'commercial',
      job_id: 'j1',
      job_number: '0100-26',
      service_tier: 'gold',
    },
  ],
};

function renderPage() {
  return render(<MemoryRouter><OccurrenceStatusReport /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('OccurrenceStatusReport', () => {
  it('prompts for service code before fetching', () => {
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();

    expect(screen.getByText(/enter a service code/i)).toBeInTheDocument();
    // useApiGet called but enabled:false — the response is undefined
  });

  it('renders KPI strip + rows once service code is set', async () => {
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();

    await userEvent.type(screen.getByLabelText('Service code'), 'FERT');

    expect(screen.getByText('Acme Co')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // completed count
    expect(screen.getByText('0100-26')).toBeInTheDocument();
  });

  it('Bulk Assign button appears once rows are selected, and triggers the API', async () => {
    const refetch = vi.fn();
    mockUseApiGet.mockReturnValue({ data: mockResponse, isLoading: false, error: null, refetch });
    mockBulkAssign.mockResolvedValue({ jobs_created: 1, occurrences_assigned: 1 });
    renderPage();

    await userEvent.type(screen.getByLabelText('Service code'), 'FERT');
    await userEvent.click(screen.getByLabelText(/select acme/i));

    const bulkBtn = screen.getByRole('button', { name: /bulk assign \(1\)/i });
    await userEvent.click(bulkBtn);
    await userEvent.click(screen.getByRole('button', { name: /^assign$/i }));

    expect(mockBulkAssign).toHaveBeenCalledWith(
      ['11111111-1111-1111-1111-111111111111'],
      expect.any(String),
    );
    expect(refetch).toHaveBeenCalled();
  });

  it('CSV export is disabled until service code is entered', async () => {
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();

    const csvBtn = screen.getByRole('button', { name: /export csv/i });
    expect(csvBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Service code'), 'FERT');
    expect(csvBtn).not.toBeDisabled();
  });
});
