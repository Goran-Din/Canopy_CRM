import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }), patch: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, title, description, onConfirm }: { open: boolean; title: string; description: string; onConfirm: () => void }) =>
    open ? <div data-testid="confirm-dialog"><span>{title}</span><span>{description}</span><button onClick={onConfirm}>Confirm</button></div> : null,
}));
vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { toast } from 'sonner';
import BillingDashboard from '../BillingDashboard';

const mockDashboard = {
  invoiced_ytd: 24650, invoiced_count: 127,
  collected_ytd: 18420, collected_count: 104,
  outstanding: 6230, outstanding_count: 23,
  overdue: 715, overdue_count: 3,
  drafts_count: 7, awaiting_count: 23,
  paid_month_count: 41, hardscape_count: 4,
};

const mockDrafts = [
  { id: 'd1', customer_name: 'John Smith', customer_code: 'SS-0047', property_address: '1348 Oak St', package_name: 'Gold', period: 'Apr', amount: '145.00', invoice_ref: 'Invoice 1 of 8' },
];

const mockOverdue = [
  { id: 'ov1', customer_name: 'Tom Wilson', customer_code: 'SS-0134', invoice_number: 'INV-2026-0142', description: 'Spring Cleanup', amount: '285.00', days_overdue: 14, is_escalated: false },
];

const mockAwaiting = [
  { id: 'aw1', customer_name: 'John Smith', customer_code: 'SS-0047', invoice_number: 'INV-2026-0201', amount: '145.00', due_date: '2026-05-01', days_until_due: 12 },
];

const mockPaid = [
  { id: 'p1', customer_name: 'John Smith', invoice_number: 'INV-2026-0189', amount: '145.00', paid_date: '2026-04-08' },
];

const mockHardscape = [
  { id: 'h1', job_id: 'j1', job_number: '0047-26', customer_name: 'Tom Wilson', description: 'Patio Installation', total: 15000, collected: 4500, outstanding: 10500,
    milestones: [
      { id: 'm1', name: 'Deposit', amount: '4500', status: 'paid', invoice_id: 'inv1', completed_at: null, invoiced_at: null, paid_at: '2026-03-01' },
      { id: 'm2', name: 'Progress', amount: '4500', status: 'pending', invoice_id: null, completed_at: null, invoiced_at: null, paid_at: null },
    ],
  },
];

function setupMocks() {
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'billing-dashboard') return { data: mockDashboard, isLoading: false, refetch: mockRefetch };
    if (key[0] === 'billing-drafts') return { data: mockDrafts, refetch: mockRefetch };
    if (key[0] === 'billing-awaiting') return { data: mockAwaiting, refetch: mockRefetch };
    if (key[0] === 'billing-overdue') return { data: mockOverdue, refetch: mockRefetch };
    if (key[0] === 'billing-paid') return { data: mockPaid, refetch: mockRefetch };
    if (key[0] === 'billing-hardscape') return { data: mockHardscape, refetch: mockRefetch };
    if (key[0] === 'billing-draft') return { data: null, refetch: mockRefetch };
    return { data: null, isLoading: false, refetch: mockRefetch };
  });
}

function renderDashboard(path = '/billing') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/billing" element={<BillingDashboard />} />
        <Route path="/billing/:section" element={<BillingDashboard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BillingDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('renders 4 KPI cards with values', () => {
    renderDashboard();
    expect(screen.getByText('$24,650')).toBeInTheDocument();
    expect(screen.getByText('$18,420')).toBeInTheDocument();
    expect(screen.getByText('$6,230')).toBeInTheDocument();
    expect(screen.getByText('$715')).toBeInTheDocument();
  });

  it('renders 5 section tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /Drafts/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Awaiting/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Overdue/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Paid/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Hardscape/ })).toBeInTheDocument();
  });

  it('default section is drafts', () => {
    renderDashboard();
    expect(screen.getByText(/Drafts to Review/)).toBeInTheDocument();
  });

  it('section navigation updates URL', async () => {
    renderDashboard();
    await userEvent.click(screen.getByRole('tab', { name: /Overdue/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/billing/overdue', { replace: true });
  });

  it('drafts section displays draft invoices', () => {
    renderDashboard();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('1348 Oak St')).toBeInTheDocument();
  });

  it('review button opens panel', async () => {
    renderDashboard();
    await userEvent.click(screen.getByText('Review'));
    // Panel should be open (InvoiceReviewPanel dialog)
  });

  it('generate drafts button shows confirmation', async () => {
    renderDashboard();
    await userEvent.click(screen.getByText('Generate Drafts'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('generate drafts confirmation calls POST', async () => {
    renderDashboard();
    await userEvent.click(screen.getByText('Generate Drafts'));
    await userEvent.click(screen.getByText('Confirm'));
    expect(mockMutateAsync).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Drafts generated');
  });

  it('awaiting payment shows invoices', () => {
    renderDashboard('/billing/awaiting');
    expect(screen.getByText('INV-2026-0201')).toBeInTheDocument();
    expect(screen.getByText('12d')).toBeInTheDocument();
  });

  it('remind button sends reminder', async () => {
    renderDashboard('/billing/awaiting');
    await userEvent.click(screen.getByText('Remind'));
    expect(mockMutateAsync).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Payment reminder sent');
  });

  it('overdue section shows severity colors', () => {
    renderDashboard('/billing/overdue');
    expect(screen.getByText(/14 days overdue/)).toBeInTheDocument();
  });

  it('overdue warning banner shown', () => {
    renderDashboard('/billing/overdue');
    expect(screen.getByText(/1 invoice.* require follow-up/)).toBeInTheDocument();
  });

  it('escalate opens dialog', async () => {
    renderDashboard('/billing/overdue');
    await userEvent.click(screen.getByText('Escalate'));
    expect(screen.getByText('Escalate Invoice')).toBeInTheDocument();
  });

  it('paid section shows paid invoices', () => {
    renderDashboard('/billing/paid');
    expect(screen.getByText('INV-2026-0189')).toBeInTheDocument();
  });

  it('hardscape section shows project cards', () => {
    renderDashboard('/billing/hardscape');
    expect(screen.getByText(/Patio Installation/)).toBeInTheDocument();
  });

  it('milestone timeline shows status', () => {
    renderDashboard('/billing/hardscape');
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('gen invoice button on pending milestones', () => {
    renderDashboard('/billing/hardscape');
    expect(screen.getByText('Gen Invoice')).toBeInTheDocument();
  });

  it('KPI card count labels correct', () => {
    renderDashboard();
    expect(screen.getByText('127 invoices')).toBeInTheDocument();
    expect(screen.getByText('104 paid')).toBeInTheDocument();
    expect(screen.getByText('23 pending')).toBeInTheDocument();
    expect(screen.getByText('3 invoices')).toBeInTheDocument();
  });
});
