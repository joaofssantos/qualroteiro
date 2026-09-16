import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActivityPlan } from './calc';
import { SaveActivityToTripDialog } from './SaveActivityToTripDialog';

const getToken = vi.fn(async () => 'session-token');

const PLAN: ActivityPlan = {
  placeName: 'Passeio de barco',
  address: 'Marina Central',
  date: '2026-10-02',
  pricePerPerson: 150,
  people: 2,
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
    title: PLAN.placeName,
    startDate: null,
    endDate: null,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
  })),
  createTripDay: vi.fn(async () => ({
    id: 'day-1',
    tripId: 'trip-1',
    date: PLAN.date,
    order: 0,
  })),
  createTripItem: vi.fn(async () => ({
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'atividades',
    kind: 'activity',
    title: PLAN.placeName,
    payload: PLAN,
    costEstimate: 300,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('SaveActivityToTripDialog', () => {
  it('saves the activity plan payload with its total cost estimate', async () => {
    const trips = await import('@/core/api/trips');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SaveActivityToTripDialog plan={PLAN} totalCost={300} />
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
          moduleId: 'atividades',
          kind: 'activity',
          title: PLAN.placeName,
          payload: PLAN,
          costEstimate: 300,
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
        <SaveActivityToTripDialog plan={PLAN} totalCost={300} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Salvar na viagem' })).not.toBeInTheDocument();
  });
});
