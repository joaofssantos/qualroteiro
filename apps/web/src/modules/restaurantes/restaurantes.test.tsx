import { act, render, screen } from '@testing-library/react';
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

vi.mock('@/core/auth/AuthContext', () => ({
  useQualAuth: vi.fn(() => ({
    isConfigured: true,
    isLoaded: true,
    isSignedIn: false,
    userName: null,
    getToken: vi.fn(async () => null),
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

  it('finds restaurants near the resolved reference and selection from list or map fills the existing form', async () => {
    const fetchSpy = mockPlaceRequests();
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(<MemoryRouter><Panel /></MemoryRouter>);

    await chooseReference(user);

    expect(await screen.findByRole('button', { name: /Casa do Porco/ })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(useMapStore.getState().layers[0]?.markers).toEqual([
      expect.objectContaining({ id: RESTAURANT.id, label: RESTAURANT.name }),
    ]);

    await user.click(screen.getByRole('button', { name: /Casa do Porco/ }));
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue(RESTAURANT.name);
    expect(screen.getByLabelText('Endereço')).toHaveValue(RESTAURANT.address);

    await act(async () => {
      useMapStore.getState().onMarkerClick?.('restaurant-results', RESTAURANT.id);
    });
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue(RESTAURANT.name);
    expect(screen.getByLabelText('Endereço')).toHaveValue(RESTAURANT.address);
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
});
