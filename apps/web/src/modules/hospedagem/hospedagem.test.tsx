import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Place, PlaceResult } from '@/core/api/types';
import { useMapStore } from '@/core/map/mapStore';
import { mockApi, renderApp, resetApp } from '@/test/renderApp';

const REFERENCE: Place = {
  id: 'rio',
  label: 'Rio de Janeiro, RJ, Brasil',
  lat: -22.9068,
  lng: -43.1729,
};
const HOTEL: PlaceResult = {
  id: 'hotel-atlantico',
  name: 'Hotel Atlântico',
  address: 'Av. Atlântica, 1',
  lat: -22.971,
  lng: -43.182,
  category: 'hospedagem',
};

const getToken = vi.fn(async () => 'session-token');

// `SaveStayToTripDialog` only gates on `isSignedIn`; `isConfigured` stays
// `false` so the real shell's `AuthActions` keeps rendering its "Login
// indisponível" fallback instead of Clerk's `UserButton` (which needs a real
// `ClerkProvider` this test tree does not have).
vi.mock('@/core/auth/AuthContext', () => ({
  useQualAuth: vi.fn(() => ({
    isConfigured: false,
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
    title: 'Hospedagem',
    startDate: null,
    endDate: null,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
  })),
  createTripDay: vi.fn(async () => ({
    id: 'day-1',
    tripId: 'trip-1',
    date: '2026-10-01',
    order: 0,
  })),
  createTripItem: vi.fn(async () => ({
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'hospedagem',
    kind: 'stay',
    title: 'Hospedagem',
    payload: {},
    costEstimate: 0,
  })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetApp();
});

describe('Hospedagem module', () => {
  it('appears in the generated nav and calculates live without network', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi();

    renderApp('/hospedagem');

    expect(screen.getByRole('link', { name: 'Hospedagem' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hospedagem' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('R$ 640,00')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Check-out'));
    await user.type(screen.getByLabelText('Check-out'), '2026-10-06');
    await user.clear(screen.getByLabelText('Preço/noite'));
    await user.type(screen.getByLabelText('Preço/noite'), '150');

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('R$ 750,00')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('associates a price validation error with its input', async () => {
    const user = userEvent.setup();
    mockApi();
    renderApp('/hospedagem');

    const input = screen.getByLabelText('Preço/noite');
    await user.clear(input);
    await user.type(input, '-1');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'lodging-price-error');
    expect(screen.getByRole('alert')).toHaveTextContent('O preço por noite não pode ser negativo.');
  });

  it('searches lodging near the selected reference and selects from the list or map', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi({ places: [REFERENCE], nearbyPlaces: [HOTEL] });

    const rendered = renderApp('/hospedagem');

    await user.type(screen.getByLabelText('Cidade, bairro ou endereço'), 'Rio');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Rio de Janeiro/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('option', { name: /Rio de Janeiro/ }));

    const results = await screen.findByRole('list', { name: 'Hospedagens encontradas' });
    expect(within(results).getByRole('button', { name: /Hotel Atlântico/ })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=hospedagem&radiusMeters=3000',
      expect.anything(),
    );

    await user.click(within(results).getByRole('button', { name: /Hotel Atlântico/ }));
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue('Hotel Atlântico');
    expect(screen.getByLabelText('Endereço')).toHaveValue('Av. Atlântica, 1');
    expect(screen.queryByRole('list', { name: 'Hospedagens encontradas' })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Nome do lugar'));
    await user.clear(screen.getByLabelText('Endereço'));
    act(() => useMapStore.getState().onMarkerClick?.('lodging-places', HOTEL.id));
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue('Hotel Atlântico');
    expect(screen.getByLabelText('Endereço')).toHaveValue('Av. Atlântica, 1');

    const referenceInput = screen.getByLabelText('Cidade, bairro ou endereço');
    await user.clear(referenceInput);
    await user.type(referenceInput, 'Rio');
    await user.click(await screen.findByRole('option', { name: /Rio de Janeiro/ }));
    expect(await screen.findByRole('list', { name: 'Hospedagens encontradas' })).toBeInTheDocument();

    expect(useMapStore.getState().layers).toHaveLength(1);
    rendered.unmount();
    expect(useMapStore.getState().layers).toEqual([]);
    expect(useMapStore.getState().trace).toBeNull();
    expect(useMapStore.getState().onMarkerClick).toBeUndefined();
  });

  it('changing the radius re-queries with the new radiusMeters, and type chips add/remove types', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi({ places: [REFERENCE], nearbyPlaces: [HOTEL] });

    renderApp('/hospedagem');

    await user.type(screen.getByLabelText('Cidade, bairro ou endereço'), 'Rio');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Rio de Janeiro/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('option', { name: /Rio de Janeiro/ }));
    await screen.findByRole('list', { name: 'Hospedagens encontradas' });

    // Default radius (3km), no types selected.
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=hospedagem&radiusMeters=3000',
      expect.anything(),
    );

    await user.selectOptions(screen.getByLabelText('Raio de busca'), '10000');
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=hospedagem&radiusMeters=10000',
        expect.anything(),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Hotel' }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=hospedagem&radiusMeters=10000&types=hotel',
        expect.anything(),
      ),
    );
    expect(screen.getByRole('button', { name: 'Hotel' })).toHaveAttribute('aria-pressed', 'true');

    // Deselecting the only chip goes back to sending no `types` at all.
    await user.click(screen.getByRole('button', { name: 'Hotel' }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=hospedagem&radiusMeters=10000',
        expect.anything(),
      ),
    );
  });

  it('keeps the manual calculator usable when nearby search fails', async () => {
    const user = userEvent.setup();
    mockApi({
      places: [REFERENCE],
      nearbyResponse: () => new Response(JSON.stringify({ error: 'provider unavailable' }), { status: 503 }),
    });
    renderApp('/hospedagem');

    await user.type(screen.getByLabelText('Cidade, bairro ou endereço'), 'Rio');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Rio de Janeiro/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('option', { name: /Rio de Janeiro/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível buscar hospedagens/i);

    await user.clear(screen.getByLabelText('Preço/noite'));
    await user.type(screen.getByLabelText('Preço/noite'), '150');
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();

  });

  it('saves the coordinates of a place selected from the search results', async () => {
    const user = userEvent.setup();
    mockApi({ places: [REFERENCE], nearbyPlaces: [HOTEL] });
    const trips = await import('@/core/api/trips');

    renderApp('/hospedagem');

    await user.type(screen.getByLabelText('Cidade, bairro ou endereço'), 'Rio');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Rio de Janeiro/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('option', { name: /Rio de Janeiro/ }));

    const results = await screen.findByRole('list', { name: 'Hospedagens encontradas' });
    await user.click(within(results).getByRole('button', { name: /Hotel Atlântico/ }));

    await user.click(screen.getByRole('button', { name: 'Salvar na viagem' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(trips.createTripItem).toHaveBeenCalledWith(
        getToken,
        'trip-1',
        'day-1',
        expect.objectContaining({
          payload: expect.objectContaining({ lat: HOTEL.lat, lng: HOTEL.lng }),
        }),
      );
    });
  });

  it('clears selected coordinates when the address is edited manually before saving', async () => {
    const user = userEvent.setup();
    mockApi({ places: [REFERENCE], nearbyPlaces: [HOTEL] });
    const trips = await import('@/core/api/trips');

    renderApp('/hospedagem');
    await user.type(screen.getByLabelText('Cidade, bairro ou endereço'), 'Rio');
    await user.click(await screen.findByRole('option', { name: /Rio de Janeiro/ }));
    const results = await screen.findByRole('list', { name: 'Hospedagens encontradas' });
    await user.click(within(results).getByRole('button', { name: /Hotel Atlântico/ }));

    const addressInput = screen.getByLabelText('Endereço');
    expect(addressInput).toHaveValue(HOTEL.address);
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

  it('keeps lat/lng null when the stay is entered manually, without selecting a search result', async () => {
    const user = userEvent.setup();
    mockApi();
    const trips = await import('@/core/api/trips');

    renderApp('/hospedagem');

    await user.clear(screen.getByLabelText('Nome do lugar'));
    await user.type(screen.getByLabelText('Nome do lugar'), 'Pousada da Vila');
    await user.type(screen.getByLabelText('Endereço'), 'Rua sem geocoding, 123');

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
