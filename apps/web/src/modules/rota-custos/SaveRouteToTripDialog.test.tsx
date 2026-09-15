import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DUTRA_ROUTE } from '@/test/fixtures';

import { SaveRouteToTripDialog } from './SaveRouteToTripDialog';

const getToken = vi.fn(async () => 'session-token');

vi.mock('@/core/auth/AuthContext', () => ({
  useQualAuth: vi.fn(() => ({
    isConfigured: true,
    isLoaded: true,
    isSignedIn: true,
    userName: 'João',
    getToken,
  })),
}));

vi.mock('@/core/api/trips', () => ({
  listTrips: vi.fn(async () => []),
  getTrip: vi.fn(),
  createTrip: vi.fn(async () => ({
    id: 'trip-1',
    userId: 'user-1',
    title: 'São Paulo → Rio de Janeiro',
    startDate: null,
    endDate: null,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
  })),
  createTripDay: vi.fn(async () => ({
    id: 'day-1',
    tripId: 'trip-1',
    date: null,
    order: 0,
  })),
  createTripItem: vi.fn(async () => ({
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'rota-custos',
    kind: 'route',
    title: 'São Paulo → Rio de Janeiro',
    payload: DUTRA_ROUTE,
    costEstimate: 310.72,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('SaveRouteToTripDialog', () => {
  it('saves the active route payload with the route cost estimate', async () => {
    const trips = await import('@/core/api/trips');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SaveRouteToTripDialog route={DUTRA_ROUTE} title="São Paulo → Rio de Janeiro" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar na viagem' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(trips.createTripItem).toHaveBeenCalledWith(
        getToken,
        'trip-1',
        'day-1',
        expect.objectContaining({
          moduleId: 'rota-custos',
          kind: 'route',
          title: 'São Paulo → Rio de Janeiro',
          payload: DUTRA_ROUTE,
          costEstimate: DUTRA_ROUTE.tolls.total + DUTRA_ROUTE.fuel.cost,
        }),
      );
    });
  });

  it('does not render the save action when the user is signed out', async () => {
    const { useQualAuth } = await import('@/core/auth/AuthContext');
    vi.mocked(useQualAuth).mockReturnValue({
      isConfigured: true,
      isLoaded: true,
      isSignedIn: false,
      userName: null,
      getToken,
    });

    render(
      <MemoryRouter>
        <SaveRouteToTripDialog route={DUTRA_ROUTE} title="São Paulo → Rio de Janeiro" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Salvar na viagem' })).not.toBeInTheDocument();
  });
});
