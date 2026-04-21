import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockUseApiGet = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
  useApiList: vi.fn(() => ({ data: [], pagination: {} })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiMutation: (..._args: any[]) => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));

// Mock auth store with owner user
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({
    user: { first_name: 'Erick', last_name: 'Owner', roles: [{ role: 'owner', division_id: null }] },
  }),
}));

import CommandCenterPage from '../CommandCenterPage';

const mockSummary = {
  crews_active: 5, crews_not_in: 1,
  billing_drafts_amount: 1160, billing_drafts_count: 3,
  billing_overdue_amount: 715, billing_overdue_count: 2,
  season_completion_pct: 53, season_pending_count: 8,
  feedback_avg_rating: 4.8, feedback_response_count: 12,
  jobs_today_total: 23, jobs_today_completed: 3, jobs_today_active: 7,
  jobs_today_scheduled: 9, jobs_today_unassigned: 4,
};

const mockCrews = [
  { crew_id: 'cr1', crew_name: "Pablo's Crew", status: 'on_site', current_property_address: '1348 Oak St', last_gps_event_at: new Date().toISOString(), jobs_today: [{ job_id: 'j1', status: 'in_progress' }, { job_id: 'j2', status: 'completed' }] },
  { crew_id: 'cr2', crew_name: "Maria's Crew", status: 'in_transit', current_property_address: null, last_gps_event_at: new Date().toISOString(), jobs_today: [] },
  { crew_id: 'cr3', crew_name: "Carlos's Crew", status: 'not_clocked_in', current_property_address: null, last_gps_event_at: null, jobs_today: [] },
];

const mockDrafts = [
  { id: 'd1', customer_name: 'John Smith', package_name: 'Gold', period: 'Apr', amount: '145.00' },
];

const mockOverdue = [
  { id: 'ov1', customer_name: 'Tom Wilson', days_overdue: 14, amount: '285.00' },
];

const mockSeason = {
  completion_pct: 53,
  services: [
    { service_name: 'Fertilization', completed: 3, total: 5, pending: 94 },
    { service_name: 'Bush Trimming', completed: 2, total: 3, pending: 47 },
  ],
};

const mockFeedback = [
  { id: 'fb1', customer_name: 'J. Smith', rating: 5, comment: 'Excellent service!', created_at: '2026-04-06' },
  { id: 'fb2', customer_name: 'M. Lopez', rating: 4, comment: 'Very punctual team', created_at: '2026-04-05' },
  { id: 'fb3', customer_name: 'T. Wilson', rating: 2, comment: 'Late arrival again', created_at: '2026-04-04' },
];

function setupMocks() {
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'command-center-summary') return { data: mockSummary, isLoading: false, refetch: mockRefetch };
    if (key[0] === 'cc-crew-positions') return { data: { positions: mockCrews }, refetch: mockRefetch };
    if (key[0] === 'cc-billing-drafts') return { data: mockDrafts, refetch: mockRefetch };
    if (key[0] === 'cc-billing-overdue') return { data: mockOverdue, refetch: mockRefetch };
    if (key[0] === 'cc-season-summary') return { data: mockSeason, refetch: mockRefetch };
    if (key[0] === 'cc-feedback') return { data: mockFeedback, refetch: mockRefetch };
    return { data: null, isLoading: false, refetch: mockRefetch };
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CommandCenterPage />
    </MemoryRouter>,
  );
}

describe('CommandCenterPage', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  // 1. Renders greeting with user first name
  it('renders greeting with user first name "Erick"', () => {
    renderPage();
    expect(screen.getByText(/Erick/)).toBeInTheDocument();
  });

  // 2. Shows current date
  it('shows current date in the header', () => {
    renderPage();
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    // At least the day-of-week name should appear in the date string
    expect(screen.getByText(new RegExp(dayName))).toBeInTheDocument();
  });

  // 3. Renders 4 summary cards
  it('renders 4 summary cards', () => {
    renderPage();
    expect(screen.getByText('Crews Today')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Season')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  // 4. Crews card shows "5 active"
  it('crews summary card shows "5 active"', () => {
    renderPage();
    expect(screen.getByText('5 active')).toBeInTheDocument();
  });

  // 5. Billing card shows "$1,160"
  it('billing summary card shows "$1,160"', () => {
    renderPage();
    expect(screen.getByText('$1,160')).toBeInTheDocument();
  });

  // 6. Season card shows "53% complete"
  it('season summary card shows "53% complete"', () => {
    renderPage();
    expect(screen.getByText('53% complete')).toBeInTheDocument();
  });

  // 7. Feedback card shows "4.8"
  it('feedback summary card shows "4.8"', () => {
    renderPage();
    expect(screen.getByText(/4\.8/)).toBeInTheDocument();
  });

  // 8. Red warning shown when crews_not_in > 0
  it('shows red warning when crews are not clocked in', () => {
    renderPage();
    expect(screen.getByText(/1 not in/)).toBeInTheDocument();
  });

  // 9. Crew panel shows crew names sorted by status (on_site first, then in_transit, then not_clocked_in)
  it('crew dispatch panel shows crew names sorted by status', () => {
    renderPage();
    expect(screen.getByText("Pablo's Crew")).toBeInTheDocument();
    expect(screen.getByText("Maria's Crew")).toBeInTheDocument();
    expect(screen.getByText("Carlos's Crew")).toBeInTheDocument();

    // Verify order: Pablo (on_site) appears before Carlos (not_clocked_in) in the DOM
    const allText = screen.getByText("Pablo's Crew").compareDocumentPosition(
      screen.getByText("Carlos's Crew"),
    );
    // DOCUMENT_POSITION_FOLLOWING = 4 means Carlos comes after Pablo
    expect(allText & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // 10. "NOT IN" crew shows warning
  it('"NOT IN" crew shows warning indicator', () => {
    renderPage();
    // Carlos is not_clocked_in — his row shows a warning emoji ⚠️
    // The STATUS_LABELS map returns 'NOT IN' for not_clocked_in
    expect(screen.getByText('NOT IN')).toBeInTheDocument();
  });

  // 11. "View Full Map" navigates to /live-map
  it('"View Full Map" button navigates to /live-map', async () => {
    renderPage();
    const viewMapBtn = screen.getByText(/View Full Map/);
    await userEvent.click(viewMapBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/live-map');
  });

  // 12. Jobs today shows status breakdown
  it('jobs today panel shows status breakdown', () => {
    renderPage();
    expect(screen.getByText(/23 total/)).toBeInTheDocument();
    expect(screen.getByText(/Completed: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Active: 7/)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled: 9/)).toBeInTheDocument();
    expect(screen.getByText(/Unassigned: 4/)).toBeInTheDocument();
  });

  // 13. Billing queue shows draft invoices
  it('billing queue shows draft invoice customer name', () => {
    renderPage();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  // 14. Billing queue shows overdue with Remind button
  it('billing queue shows overdue invoice with Remind button', () => {
    renderPage();
    expect(screen.getByText('Tom Wilson')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remind/i })).toBeInTheDocument();
  });

  // 15. Remind button calls mutation
  it('Remind button calls mutateAsync', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Remind/i }));
    expect(mockMutateAsync).toHaveBeenCalledWith({ invoice_id: 'ov1' });
  });

  // 16. Season progress shows pending services
  it('season progress panel shows pending services', () => {
    renderPage();
    expect(screen.getByText('Fertilization')).toBeInTheDocument();
    expect(screen.getByText('Bush Trimming')).toBeInTheDocument();
    // Shows pending counts
    expect(screen.getByText('94 pending')).toBeInTheDocument();
    expect(screen.getByText('47 pending')).toBeInTheDocument();
  });

  // 17. Feedback panel shows 3 responses with star rating display
  it('feedback panel shows 3 responses', () => {
    renderPage();
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('M. Lopez')).toBeInTheDocument();
    expect(screen.getByText('T. Wilson')).toBeInTheDocument();
  });

  // 18. Low rating (<=2) shown with amber background
  it('low rating feedback row has amber background class', () => {
    renderPage();
    // T. Wilson has rating 2 — the wrapping div should carry bg-amber-50
    const wilsonName = screen.getByText('T. Wilson');
    const feedbackRow = wilsonName.closest('[class*="amber"]') ?? wilsonName.closest('div[class]');
    expect(feedbackRow?.className).toMatch(/amber/);
  });

  // 19. Refresh button exists
  it('refresh button is present in the header', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  // 20. Wave 7 Brief 06 — cross-check flags banner for owners when flagged_count > 0
  it('owner sees cross-check flags banner when flagged_count > 0', () => {
    mockUseApiGet.mockImplementation((key: string[]) => {
      if (key[0] === 'command-center-summary') return { data: mockSummary, isLoading: false, refetch: mockRefetch };
      if (key[0] === 'cc-crew-positions') return { data: { positions: mockCrews }, refetch: mockRefetch };
      if (key[0] === 'cc-billing-drafts') return { data: mockDrafts, refetch: mockRefetch };
      if (key[0] === 'cc-billing-overdue') return { data: mockOverdue, refetch: mockRefetch };
      if (key[0] === 'cc-season-summary') return { data: mockSeason, refetch: mockRefetch };
      if (key[0] === 'cc-feedback') return { data: mockFeedback, refetch: mockRefetch };
      if (key[0] === 'cc-cross-check-today') return { data: { totals: { days_reviewed: 1, flagged_count: 3, consistent_count: 0 }, rows: [] }, refetch: mockRefetch };
      if (key[0] === 'cc-unverified-week') return { data: { totals: { total: 0, verified: 0, unverified: 0, no_gps: 0, verification_rate: 0 }, rows: [] }, refetch: mockRefetch };
      return { data: null, isLoading: false, refetch: mockRefetch };
    });
    renderPage();

    const banner = screen.getByRole('link', { name: /view today's cross-check flags/i });
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/3 cross-check flag/);
    expect(banner.getAttribute('href')).toMatch(/\/reports\/gps\/payroll-cross-check/);
    expect(banner.getAttribute('href')).toMatch(/status=flagged/);
  });

  // 21. Banner hidden when flagged_count == 0
  it('cross-check banner is hidden when flagged_count is 0', () => {
    mockUseApiGet.mockImplementation((key: string[]) => {
      if (key[0] === 'cc-cross-check-today') return { data: { totals: { days_reviewed: 0, flagged_count: 0, consistent_count: 0 }, rows: [] }, refetch: mockRefetch };
      if (key[0] === 'command-center-summary') return { data: mockSummary, isLoading: false, refetch: mockRefetch };
      if (key[0] === 'cc-crew-positions') return { data: { positions: mockCrews }, refetch: mockRefetch };
      if (key[0] === 'cc-billing-drafts') return { data: mockDrafts, refetch: mockRefetch };
      if (key[0] === 'cc-billing-overdue') return { data: mockOverdue, refetch: mockRefetch };
      if (key[0] === 'cc-season-summary') return { data: mockSeason, refetch: mockRefetch };
      if (key[0] === 'cc-feedback') return { data: mockFeedback, refetch: mockRefetch };
      return { data: null, isLoading: false, refetch: mockRefetch };
    });
    renderPage();

    expect(screen.queryByRole('link', { name: /view today's cross-check flags/i })).toBeNull();
  });

  // 22. Unverified services card renders with this-week date range
  it('renders unverified services card with this-week link', () => {
    mockUseApiGet.mockImplementation((key: string[]) => {
      if (key[0] === 'cc-unverified-week') return { data: { totals: { total: 10, verified: 6, unverified: 4, no_gps: 0, verification_rate: 60 }, rows: [] }, refetch: mockRefetch };
      if (key[0] === 'command-center-summary') return { data: mockSummary, isLoading: false, refetch: mockRefetch };
      if (key[0] === 'cc-crew-positions') return { data: { positions: mockCrews }, refetch: mockRefetch };
      if (key[0] === 'cc-billing-drafts') return { data: mockDrafts, refetch: mockRefetch };
      if (key[0] === 'cc-billing-overdue') return { data: mockOverdue, refetch: mockRefetch };
      if (key[0] === 'cc-season-summary') return { data: mockSeason, refetch: mockRefetch };
      if (key[0] === 'cc-feedback') return { data: mockFeedback, refetch: mockRefetch };
      return { data: null, isLoading: false, refetch: mockRefetch };
    });
    renderPage();

    const link = screen.getByRole('link', { name: /view unverified services this week/i });
    expect(link).toHaveTextContent(/4 unverified service/);
    expect(link.getAttribute('href')).toMatch(/\/reports\/gps\/service-verification/);
    expect(link.getAttribute('href')).toMatch(/verification=unverified/);
  });
});
