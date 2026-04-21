import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { useAuthStore } from '@/stores/authStore';
import ReportsHome from '../ReportsHome';

function loginAs(role: string) {
  useAuthStore.setState({
    accessToken: 'tok',
    user: {
      id: 'u', email: 'x@y.z', first_name: 'X', last_name: 'Y',
      tenant_id: 't', roles: [{ role, division_id: null }],
    },
  });
}

function renderHome() {
  return render(<MemoryRouter><ReportsHome /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('ReportsHome', () => {
  it('renders all four category sections', () => {
    loginAs('owner');
    renderHome();

    expect(screen.getByRole('region', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'GPS Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Financial/ })).toBeInTheDocument();
  });

  it('owner sees owner-only cards as normal links (no lock icon)', () => {
    loginAs('owner');
    renderHome();

    const tier = screen.getByRole('link', { name: 'Tier Performance' });
    expect(tier).toBeInTheDocument();
    expect(within(tier).queryByLabelText('Owner only')).toBeNull();

    const payroll = screen.getByRole('link', { name: 'Payroll Cross-Check' });
    expect(payroll).toBeInTheDocument();
    expect(within(payroll).queryByLabelText('Owner only')).toBeNull();
  });

  it('non-owner (coordinator) sees owner-only cards locked (no navigation link)', () => {
    loginAs('coordinator');
    renderHome();

    // Tier Performance — owner-only → no link, still visible as a group
    expect(screen.queryByRole('link', { name: 'Tier Performance' })).toBeNull();
    const tierGroup = screen.getByRole('group', { name: /Tier Performance \(owner only\)/i });
    expect(within(tierGroup).getByLabelText('Owner only')).toBeInTheDocument();

    // Non-owner-only cards are still reachable as links
    expect(screen.getByRole('link', { name: 'Season Completion' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Service Verification' })).toBeInTheDocument();
  });

  it('non-owner sees Payroll Cross-Check locked too', () => {
    loginAs('div_mgr');
    renderHome();

    expect(screen.queryByRole('link', { name: 'Payroll Cross-Check' })).toBeNull();
    expect(
      screen.getByRole('group', { name: /Payroll Cross-Check \(owner only\)/i }),
    ).toBeInTheDocument();
  });

  it('Financial (V1) card links to /reports/financial', () => {
    loginAs('owner');
    renderHome();

    const fin = screen.getByRole('link', { name: 'Financial Reports' });
    expect(fin.getAttribute('href')).toBe('/reports/financial');
  });

  it('GPS card links to correct sub-routes', () => {
    loginAs('owner');
    renderHome();

    expect(
      screen.getByRole('link', { name: 'Property Visit History' }).getAttribute('href'),
    ).toBe('/reports/gps/property-visits');
    expect(
      screen.getByRole('link', { name: 'Route Performance' }).getAttribute('href'),
    ).toBe('/reports/gps/route-performance');
  });
});
