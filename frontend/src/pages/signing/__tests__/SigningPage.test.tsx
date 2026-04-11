import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SigningPage from '../SigningPage';

// Mock the publicApi module
vi.mock('@/api/publicClient', () => ({
  publicApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

// Mock @/components/ui/sonner (uses next-themes which is not available in test env)
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

// Mock next-themes (used transitively by @/components/ui/sonner)
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

import { publicApi } from '@/api/publicClient';
import { toast } from 'sonner';

// Mock canvas getContext and getBoundingClientRect for jsdom
beforeEach(() => {
  // Provide a minimal 2D context mock so SignatureCanvas can initialize
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    lineCap: '',
    lineJoin: '',
    lineWidth: 0,
    strokeStyle: '',
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // getBoundingClientRect returns zeros by default in jsdom — provide a real rect
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    right: 400,
    bottom: 200,
    width: 400,
    height: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  // toDataURL returns a minimal base64 PNG so the submit path gets a non-empty string
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(
    'data:image/png;base64,iVBORw0KGgo=',
  );
});

const mockQuote = {
  quote_number: 'Q-2026-001',
  valid_until: '2026-05-01',
  customer_name: 'John Smith',
  property_address: '123 Main St, Austin TX',
  sections: [
    {
      id: 's1',
      title: 'Weekly Maintenance',
      body: 'Regular lawn care',
      sort_order: 1,
      line_items: [
        { id: 'li1', description: 'Mowing', quantity: 4, unit_price: 35, line_total: 140, sort_order: 1 },
        { id: 'li2', description: 'Edging', quantity: 4, unit_price: 15, line_total: 60, sort_order: 2 },
      ],
    },
    {
      id: 's2',
      title: 'Monthly Services',
      body: null,
      sort_order: 2,
      line_items: [
        { id: 'li3', description: 'Fertilization', quantity: 1, unit_price: 85, line_total: 85, sort_order: 1 },
      ],
    },
  ],
  subtotal: 285,
  discount_amount: 10,
  total: 275,
  client_notes: 'Work starts Monday.',
  payment_terms: 'Net 30',
  company_phone: '(512) 555-0100',
  company_email: 'info@sunsetservices.com',
};

function renderPage(token = 'valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/sign/${token}`]}>
      <Routes>
        <Route path="/sign/:token" element={<SigningPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SigningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders quote summary on successful fetch (200)', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Austin TX')).toBeInTheDocument();
  });

  it('renders expired screen on 401 with expired message', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 401, data: { message: 'Token has expired' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('This Quote Has Expired')).toBeInTheDocument();
    });
  });

  it('renders invalid screen on 401 with other message', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 401, data: { message: 'Invalid token' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Link Not Found')).toBeInTheDocument();
    });
  });

  it('renders already-signed screen on 409', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 409, data: { message: 'Already signed' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Already Signed')).toBeInTheDocument();
    });
  });

  it('submit button disabled when name is empty', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    expect(button).toBeDisabled();
  });

  it('submit button disabled when checkbox is unchecked', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    expect(button).toBeDisabled();
  });

  it('submit button disabled when canvas is blank', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    expect(button).toBeDisabled();
  });

  it('successful submission transitions to success screen', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    (publicApi.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Simulate drawing on canvas
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Quote Accepted!')).toBeInTheDocument();
    });
  });

  it('rate limit (429) shows appropriate error message', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    (publicApi.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 429, data: { message: 'Rate limited' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Too many attempts. Please wait a moment and try again.');
    });
  });

  it('success screen shows signer name', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    (publicApi.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'Jane Doe');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Thank you, Jane Doe.')).toBeInTheDocument();
    });
  });

  it('no internal_notes rendered anywhere in the component', async () => {
    const quoteWithInternalNotes = {
      ...mockQuote,
      internal_notes: 'SECRET: give 20% discount next time',
    };
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: quoteWithInternalNotes });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal_notes/)).not.toBeInTheDocument();
  });

  it('quote sections render in correct order with line items', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Monthly Services')).toBeInTheDocument();
    expect(screen.getByText('Mowing')).toBeInTheDocument();
    expect(screen.getByText('Edging')).toBeInTheDocument();
    expect(screen.getByText('Fertilization')).toBeInTheDocument();
  });

  it('currency values formatted correctly', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    expect(screen.getByText('$285.00')).toBeInTheDocument();
    expect(screen.getByText('$275.00')).toBeInTheDocument();
    expect(screen.getByText('-$10.00')).toBeInTheDocument();
  });
});
