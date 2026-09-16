import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LodgingStay } from '../hospedagem/calc';
import type { TripDetail, TripItem } from '@/core/api/trips';

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
  createTrip: vi.fn(),
  createTripDay: vi.fn(),
  createTripItem: vi.fn(),
  deleteTripItem: vi.fn(async () => undefined),
}));

const STAY: LodgingStay = {
  placeName: 'Pousada do Centro',
  address: 'Rua Central, 10',
  checkIn: '2026-10-01',
  checkOut: '2026-10-04',
  pricePerNight: 150,
};

function stayItem(overrides: Partial<TripItem> = {}): TripItem {
  return {
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'hospedagem',
    kind: 'stay',
    title: STAY.placeName,
    payload: STAY,
    costEstimate: 450,
    ...overrides,
  };
}

function tripWith(items: readonly TripItem[]): TripDetail {
  return {
    id: 'trip-1',
    userId: 'user-1',
    title: 'Férias no litoral',
    startDate: null,
    endDate: null,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
    days: [
      {
        id: 'day-1',
        tripId: 'trip-1',
        date: '2026-10-01',
        order: 0,
        items,
      },
    ],
  };
}

async function renderTripDetail() {
  const { TripDetailScreen } = await import('./index');
  return render(
    <MemoryRouter initialEntries={['/trip-1']}>
      <Routes>
        <Route path=":tripId" element={<TripDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('TripDetailScreen — delete item', () => {
  it('deletes the item, reloads the trip and updates the list and budget total', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip)
      .mockResolvedValueOnce(tripWith([stayItem()]))
      .mockResolvedValueOnce(tripWith([]));
    vi.stubGlobal('confirm', vi.fn(() => true));

    const user = userEvent.setup();
    await renderTripDetail();

    await screen.findByText(STAY.placeName);
    expect(screen.getByTestId('trip-budget-total')).toHaveTextContent('R$ 450,00');

    await user.click(screen.getByRole('button', { name: /excluir/i }));

    await waitFor(() => {
      expect(trips.deleteTripItem).toHaveBeenCalledWith(getToken, 'trip-1', 'day-1', 'item-1');
    });

    await waitFor(() => {
      expect(screen.queryByText(STAY.placeName)).not.toBeInTheDocument();
    });
    expect(trips.getTrip).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('trip-budget-total')).toHaveTextContent('R$ 0,00');
  });

  it('does not delete when the confirm guard is declined', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(tripWith([stayItem()]));
    vi.stubGlobal('confirm', vi.fn(() => false));

    const user = userEvent.setup();
    await renderTripDetail();

    await screen.findByText(STAY.placeName);
    await user.click(screen.getByRole('button', { name: /excluir/i }));

    expect(trips.deleteTripItem).not.toHaveBeenCalled();
    expect(trips.getTrip).toHaveBeenCalledTimes(1);
  });
});

describe('TripDetailScreen — per-module rich summary', () => {
  it('renders a nights/price summary for a hospedagem item instead of the raw moduleId · kind text', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(tripWith([stayItem()]));

    await renderTripDetail();

    const item = await screen.findByText(STAY.placeName);
    const row = item.closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByText('hospedagem · stay')).not.toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/noites?/i)).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/R\$\s*150,00\/noite/)).toBeInTheDocument();
  });

  it('falls back to the raw moduleId · kind text without throwing for an unrecognized moduleId', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(
      tripWith([
        stayItem({
          id: 'item-2',
          moduleId: 'frete',
          kind: 'shipment',
          title: 'Frete São Paulo → Curitiba',
          payload: { anything: 'goes' },
          costEstimate: 90,
        }),
      ]),
    );

    await renderTripDetail();

    await screen.findByText('Frete São Paulo → Curitiba');
    expect(screen.getByText('frete · shipment')).toBeInTheDocument();
  });
});
