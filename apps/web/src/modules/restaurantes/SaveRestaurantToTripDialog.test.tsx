import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantCost, RestaurantVisit } from './calc';
import { SaveRestaurantToTripDialog } from './SaveRestaurantToTripDialog';

const getToken = vi.fn(async () => 'session-token');

const visit: RestaurantVisit = {
  placeName: 'Casa do Porco',
  address: 'Rua Araujo, 124',
  date: '2026-10-12',
  pricePerPerson: 120,
  people: 3,
};

const cost: RestaurantCost = { totalCost: 360 };

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
    title: 'Casa do Porco',
    startDate: null,
    endDate: null,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
  })),
  createTripDay: vi.fn(async () => ({
    id: 'day-1',
    tripId: 'trip-1',
    date: '2026-10-12',
    order: 0,
  })),
  createTripItem: vi.fn(async () => ({
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'restaurantes',
    kind: 'meal',
    title: 'Casa do Porco',
    payload: visit,
    costEstimate: 360,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('SaveRestaurantToTripDialog', () => {
  it('saves the restaurant visit payload with the calculated cost estimate', async () => {
    const trips = await import('@/core/api/trips');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SaveRestaurantToTripDialog visit={visit} cost={cost} />
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
          moduleId: 'restaurantes',
          kind: 'meal',
          title: 'Casa do Porco',
          payload: visit,
          costEstimate: 360,
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
        <SaveRestaurantToTripDialog visit={visit} cost={cost} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Salvar na viagem' })).not.toBeInTheDocument();
  });
});
