import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMapStore } from '@/core/map/mapStore';
import { restaurantesModule } from '.';

const SAO_PAULO = { id: 'sp', label: 'São Paulo, SP, Brasil', lng: -46.6333, lat: -23.5505 };
const RESTAURANT = {
  id: 'casa-do-porco',
  name: 'Casa do Porco',
  address: 'Rua Araújo, 124 - República, São Paulo - SP',
  lat: -23.545,
  lng: -46.64,
  category: 'restaurantes' as const,
};

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
    title: 'Restaurantes',
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
    moduleId: 'restaurantes',
    kind: 'meal',
    title: 'Restaurantes',
    payload: {},
    costEstimate: 0,
  })),
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockPlaceRequests(nearbyResponse: () => Response = () => json({ places: [RESTAURANT] })) {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/places/search')) return json({ places: [SAO_PAULO] });
    if (url.startsWith('/api/places/nearby')) return nearbyResponse();
    throw new Error(`unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

async function chooseReference(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Ponto de referência'), 'São Paulo');
  await user.click(await screen.findByRole('option', { name: SAO_PAULO.label }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  useMapStore.getState().clearMap();
});

describe('restaurantes module', () => {
  it('calculates the total cost live without submitting to the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(
      <MemoryRouter>
        <Panel />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText('Preço por pessoa'));
    await user.type(screen.getByLabelText('Preço por pessoa'), '50');
    await user.clear(screen.getByLabelText('Pessoas'));
    await user.type(screen.getByLabelText('Pessoas'), '4');

    expect(screen.getByText('R$ 200,00')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('associates a people validation error with its input', async () => {
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(
      <MemoryRouter>
        <Panel />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText('Pessoas');
    await user.clear(input);
    await user.type(input, '0');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'restaurant-people-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Informe pelo menos uma pessoa.');
  });

  it('finds restaurants near the resolved reference and selection from list or map fills the existing form', async () => {
    const fetchSpy = mockPlaceRequests();
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);

    await chooseReference(user);

    expect(await screen.findByRole('button', { name: /Casa do Porco/ })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes&radiusMeters=3000',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(useMapStore.getState().layers[0]?.markers).toEqual([
      expect.objectContaining({ id: RESTAURANT.id, label: RESTAURANT.name }),
    ]);

    await user.click(screen.getByRole('button', { name: /Casa do Porco/ }));
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue(RESTAURANT.name);
    expect(screen.getByLabelText('Endereço')).toHaveValue(RESTAURANT.address);
    expect(screen.queryByRole('list', { name: 'Restaurantes encontrados' })).not.toBeInTheDocument();

    await act(async () => {
      useMapStore.getState().onMarkerClick?.('restaurant-results', RESTAURANT.id);
    });
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue(RESTAURANT.name);
    expect(screen.getByLabelText('Endereço')).toHaveValue(RESTAURANT.address);

    const referenceInput = screen.getByLabelText('Ponto de referência');
    await user.clear(referenceInput);
    await chooseReference(user);
    expect(await screen.findByRole('list', { name: 'Restaurantes encontrados' })).toBeInTheDocument();
  });

  it('changing the radius re-queries with the new radiusMeters, and type chips add/remove types', async () => {
    const fetchSpy = mockPlaceRequests();
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);
    await chooseReference(user);
    await screen.findByRole('button', { name: /Casa do Porco/ });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes&radiusMeters=3000',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await user.selectOptions(screen.getByLabelText('Raio de busca'), '5000');
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes&radiusMeters=5000',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Café' }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes&radiusMeters=5000&types=cafe',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Bar' }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes&radiusMeters=5000&types=cafe%2Cbar',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Café' }));
    await user.click(screen.getByRole('button', { name: 'Bar' }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes&radiusMeters=5000',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('keeps the cost calculator usable when nearby search fails', async () => {
    mockPlaceRequests(() => json({ error: 'Google Places provider failed' }, 502));
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);
    await chooseReference(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível buscar restaurantes/i);
    await user.clear(screen.getByLabelText('Preço por pessoa'));
    await user.type(screen.getByLabelText('Preço por pessoa'), '50');
    await user.clear(screen.getByLabelText('Pessoas'));
    await user.type(screen.getByLabelText('Pessoas'), '4');
    expect(screen.getByText('R$ 200,00')).toBeInTheDocument();
  });

  it('clears the shared map store when the restaurant module unmounts', async () => {
    mockPlaceRequests();
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;
    const { unmount } = render(<MemoryRouter><Panel /></MemoryRouter>);

    await chooseReference(user);
    await screen.findByRole('button', { name: /Casa do Porco/ });
    expect(useMapStore.getState().layers[0]?.markers).toHaveLength(1);

    unmount();

    expect(useMapStore.getState().layers).toEqual([]);
    expect(useMapStore.getState().trace).toBeNull();
    expect(useMapStore.getState().onMarkerClick).toBeUndefined();
  });

  it('saves the coordinates of a restaurant selected from the search results', async () => {
    mockPlaceRequests();
    const user = userEvent.setup();
    const trips = await import('@/core/api/trips');
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);
    await chooseReference(user);

    await user.click(await screen.findByRole('button', { name: /Casa do Porco/ }));

    await user.click(screen.getByRole('button', { name: 'Salvar na viagem' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(trips.createTripItem).toHaveBeenCalledWith(
        getToken,
        'trip-1',
        'day-1',
        expect.objectContaining({
          payload: expect.objectContaining({ lat: RESTAURANT.lat, lng: RESTAURANT.lng }),
        }),
      );
    });
  });

  it('clears selected coordinates when the address is edited manually before saving', async () => {
    mockPlaceRequests();
    const user = userEvent.setup();
    const trips = await import('@/core/api/trips');
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);
    await chooseReference(user);
    await user.click(await screen.findByRole('button', { name: /Casa do Porco/ }));

    const addressInput = screen.getByLabelText('Endereço');
    expect(addressInput).toHaveValue(RESTAURANT.address);
    await user.clear(addressInput);
    await user.type(addressInput, 'Rua Nova, 123');

    await user.click(screen.getByRole('button', { name: 'Salvar na viagem' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(trips.createTripItem).toHaveBeenCalledWith(
        getToken,
        'trip-1',
        'day-1',
        expect.objectContaining({
          payload: expect.objectContaining({ address: 'Rua Nova, 123', lat: null, lng: null }),
        }),
      );
    });
  });

  it('keeps lat/lng null when the visit is entered manually, without selecting a search result', async () => {
    const user = userEvent.setup();
    const trips = await import('@/core/api/trips');
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);

    await user.clear(screen.getByLabelText('Nome do lugar'));
    await user.type(screen.getByLabelText('Nome do lugar'), 'Restaurante da esquina');
    await user.type(screen.getByLabelText('Endereço'), 'Rua sem geocoding, 99');

    await user.click(screen.getByRole('button', { name: 'Salvar na viagem' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(trips.createTripItem).toHaveBeenCalledWith(
        getToken,
        'trip-1',
        'day-1',
        expect.objectContaining({
          payload: expect.objectContaining({ lat: null, lng: null }),
        }),
      );
    });
  });
});
