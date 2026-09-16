import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LodgingStay } from '../hospedagem/calc';
import type { TripDetail, TripItem } from '@/core/api/trips';

const getToken = vi.fn(async () => 'session-token');
let dragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null;

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
  updateTripDay: vi.fn(async () => ({ id: 'day-1', tripId: 'trip-1', date: null, order: 0 })),
  updateTripItem: vi.fn(async () => ({
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'hospedagem',
    kind: 'stay',
    title: 'Pousada do Centro',
    payload: {},
    costEstimate: 450,
  })),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void;
  }) => {
    dragEnd = onDragEnd;
    return <>{children}</>;
  },
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  arrayMove: <T,>(items: readonly T[], from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    return next;
  },
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: vi.fn(() => undefined) } },
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

function tripWith(items: readonly TripItem[], secondDayItems: readonly TripItem[] = []): TripDetail {
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
      {
        id: 'day-2',
        tripId: 'trip-1',
        date: '2026-10-02',
        order: 1,
        items: secondDayItems,
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
  dragEnd = null;
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

describe('TripDetailScreen — reorder timeline', () => {
  it('reorders an item within a day and persists the new order', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(
      tripWith([
        stayItem({ id: 'item-1', title: 'Pousada' }),
        stayItem({ id: 'item-2', title: 'Jantar', moduleId: 'restaurantes', kind: 'meal' }),
      ]),
    );

    await renderTripDetail();
    await screen.findByText('Jantar');

    dragEnd?.({ active: { id: 'item:item-2' }, over: { id: 'item:item-1' } });

    await waitFor(() => {
      expect(trips.updateTripItem).toHaveBeenCalledWith(getToken, 'trip-1', 'day-1', 'item-2', {
        order: 0,
        tripDayId: 'day-1',
      });
    });
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Jantar'),
      expect.stringContaining('Pousada'),
    ]);
  });

  it('moves an item to another day and persists the new tripDayId', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(tripWith([stayItem({ id: 'item-1' })]));

    await renderTripDetail();
    await screen.findByText(STAY.placeName);

    dragEnd?.({ active: { id: 'item:item-1' }, over: { id: 'day:day-2' } });

    await waitFor(() => {
      expect(trips.updateTripItem).toHaveBeenCalledWith(getToken, 'trip-1', 'day-1', 'item-1', {
        order: 0,
        tripDayId: 'day-2',
      });
    });
  });

  it('rolls the UI back and shows an error when saving an item reorder fails', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(
      tripWith([
        stayItem({ id: 'item-1', title: 'Pousada' }),
        stayItem({ id: 'item-2', title: 'Jantar', moduleId: 'restaurantes', kind: 'meal' }),
      ]),
    );
    vi.mocked(trips.updateTripItem).mockRejectedValueOnce(new Error('Falha ao salvar ordem'));

    await renderTripDetail();
    await screen.findByText('Jantar');

    dragEnd?.({ active: { id: 'item:item-2' }, over: { id: 'item:item-1' } });

    await screen.findByText('Falha ao salvar ordem');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Pousada'),
      expect.stringContaining('Jantar'),
    ]);
  });

  it('reorders days and persists the new day order', async () => {
    const trips = await import('@/core/api/trips');
    vi.mocked(trips.getTrip).mockResolvedValueOnce(tripWith([stayItem()]));

    await renderTripDetail();
    await screen.findByText('2026-10-02');

    dragEnd?.({ active: { id: 'day:day-2' }, over: { id: 'day:day-1' } });

    await waitFor(() => {
      expect(trips.updateTripDay).toHaveBeenCalledWith(getToken, 'trip-1', 'day-2', {
        order: 0,
      });
    });
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
