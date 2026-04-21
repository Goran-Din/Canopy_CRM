import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseApiGet = vi.fn();
const mockNavigate = vi.fn();
const mockResolve = vi.fn();
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
  resolvePayrollCrossCheck: (...args: unknown[]) => mockResolve(...args),
  downloadReportCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

// Import authStore so we can drive `user` per test.
import { useAuthStore } from '@/stores/authStore';
import PayrollCrossCheckReport from '../PayrollCrossCheckReport';

const FLAGGED_ROW = {
  gps_event_id: 'ffffffff-0000-0000-0000-0000000000aa',
  work_date: '2026-06-15',
  user_id: 'user-1',
  crew_member: 'Jane Doe',
  layer1_minutes: 480,
  layer2_minutes: 400,
  diff_minutes: 80,
  diff_pct: 16.7,
  properties_visited: 4,
  status: 'flagged' as const,
};

const CONSISTENT_ROW = {
  ...FLAGGED_ROW,
  gps_event_id: null,
  user_id: 'user-2',
  work_date: '2026-06-16',
  crew_member: 'John Smith',
  layer1_minutes: 480,
  layer2_minutes: 475,
  diff_minutes: 5,
  diff_pct: 1.0,
  status: 'consistent' as const,
};

function loginAs(role: string) {
  useAuthStore.setState({
    accessToken: 'tok',
    user: {
      id: 'u1', email: 'x@y.z', first_name: 'X', last_name: 'Y',
      tenant_id: 't1', roles: [{ role, division_id: null }],
    },
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PayrollCrossCheckReport />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('PayrollCrossCheckReport — role guard', () => {
  it('non-owner (div_mgr) is redirected to /reports with a toast', async () => {
    loginAs('div_mgr');
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/reports', { replace: true });
    });
  });

  it('non-owner (coordinator) is redirected', async () => {
    loginAs('coordinator');
    mockUseApiGet.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/reports', { replace: true });
    });
  });

  it('owner sees the page and the mandated informational banner', () => {
    loginAs('owner');
    mockUseApiGet.mockReturnValue({
      data: { totals: { days_reviewed: 0, flagged_count: 0, consistent_count: 0 }, rows: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: /payroll cross-check/i })).toBeInTheDocument();
    expect(screen.getByText(/informational only/i)).toBeInTheDocument();
    expect(screen.getByText(/does not adjust pay/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('PayrollCrossCheckReport — content', () => {
  beforeEach(() => loginAs('owner'));

  it('renders KPI strip + rows with status badges', () => {
    mockUseApiGet.mockReturnValue({
      data: {
        totals: { days_reviewed: 2, flagged_count: 1, consistent_count: 1 },
        rows: [FLAGGED_ROW, CONSISTENT_ROW],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('flagged')).toBeInTheDocument();
    expect(screen.getByText('consistent')).toBeInTheDocument();
  });

  it('shows Resolve button only on flagged rows with a gps_event_id', () => {
    mockUseApiGet.mockReturnValue({
      data: {
        totals: { days_reviewed: 2, flagged_count: 1, consistent_count: 1 },
        rows: [FLAGGED_ROW, CONSISTENT_ROW],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    const resolveButtons = screen.getAllByRole('button', { name: /^resolve$/i });
    expect(resolveButtons).toHaveLength(1);
  });

  it('opens Resolve dialog and submits the note to the API', async () => {
    const refetch = vi.fn();
    mockUseApiGet.mockReturnValue({
      data: {
        totals: { days_reviewed: 1, flagged_count: 1, consistent_count: 0 },
        rows: [FLAGGED_ROW],
      },
      isLoading: false,
      error: null,
      refetch,
    });
    mockResolve.mockResolvedValue({ status: 'reviewed', gps_event_id: FLAGGED_ROW.gps_event_id });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /^resolve$/i }));

    const noteInput = await screen.findByLabelText(/resolve note/i);
    await userEvent.type(noteInput, 'Confirmed with crew.');
    await userEvent.click(screen.getByRole('button', { name: /mark reviewed/i }));

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledWith(
        FLAGGED_ROW.gps_event_id,
        'Confirmed with crew.',
      );
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('Mark Reviewed is disabled until note is non-empty', async () => {
    mockUseApiGet.mockReturnValue({
      data: {
        totals: { days_reviewed: 1, flagged_count: 1, consistent_count: 0 },
        rows: [FLAGGED_ROW],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const confirmBtn = await screen.findByRole('button', { name: /mark reviewed/i });
    expect(confirmBtn).toBeDisabled();

    const noteInput = screen.getByLabelText(/resolve note/i);
    await userEvent.type(noteInput, 'ok');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('shows empty state when no rows', () => {
    mockUseApiGet.mockReturnValue({
      data: { totals: { days_reviewed: 0, flagged_count: 0, consistent_count: 0 }, rows: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/no time entries in this range/i)).toBeInTheDocument();
  });

  it('renders diff_pct as "—" when null (no divide-by-zero display)', () => {
    mockUseApiGet.mockReturnValue({
      data: {
        totals: { days_reviewed: 1, flagged_count: 1, consistent_count: 0 },
        rows: [{ ...FLAGGED_ROW, layer1_minutes: 0, diff_pct: null }],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('CSV export button triggers downloadReportCsv', async () => {
    mockUseApiGet.mockReturnValue({
      data: { totals: { days_reviewed: 0, flagged_count: 0, consistent_count: 0 }, rows: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockDownloadCsv).toHaveBeenCalledWith(
      '/v1/reports/payroll-cross-check',
      expect.objectContaining({ from_date: expect.any(String), to_date: expect.any(String) }),
      expect.stringMatching(/^payroll-cross-check-.*\.csv$/),
    );
  });
});
