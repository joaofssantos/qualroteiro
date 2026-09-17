import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LodgingStay } from './calc';
import { SaveStayToTripDialog } from './SaveStayToTripDialog';

const getToken = vi.fn(async () => 'session-token');

const STAY: LodgingStay = {
  placeName: 'Pousada do Centro',
  address: 'Rua Central, 10',
  lat: -22.971,
  lng: -43.182,
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  pricePerNight: 300,
};

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
    title: STAY.placeName,
    startDate: null,
    endDate: null,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
  })),
  createTripDay: vi.fn(async () => ({
    id: 'day-1',
    tripId: 'trip-1',
    date: STAY.checkIn,
    order: 0,
  })),
  createTripItem: vi.fn(async () => ({
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'hospedagem',
    kind: 'stay',
    title: STAY.placeName,
    payload: STAY,
    costEstimate: 600,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('SaveStayToTripDialog', () => {
  it('saves the lodging stay payload with its total cost estimate', async () => {
    const trips = await import('@/core/api/trips');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SaveStayToTripDialog stay={STAY} totalCost={600} />
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
          moduleId: 'hospedagem',
          kind: 'stay',
          title: STAY.placeName,
          payload: STAY,
          costEstimate: 600,
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
        <SaveStayToTripDialog stay={STAY} totalCost={600} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Salvar na viagem' })).not.toBeInTheDocument();
  });
});
