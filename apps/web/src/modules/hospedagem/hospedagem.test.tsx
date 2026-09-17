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

afterEach(() => {
  vi.unstubAllGlobals();
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
      '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=hospedagem',
      expect.anything(),
    );

    await user.click(within(results).getByRole('button', { name: /Hotel Atlântico/ }));
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue('Hotel Atlântico');
    expect(screen.getByLabelText('Endereço')).toHaveValue('Av. Atlântica, 1');

    await user.clear(screen.getByLabelText('Nome do lugar'));
    await user.clear(screen.getByLabelText('Endereço'));
    act(() => useMapStore.getState().onMarkerClick?.('lodging-places', HOTEL.id));
    expect(screen.getByLabelText('Nome do lugar')).toHaveValue('Hotel Atlântico');
    expect(screen.getByLabelText('Endereço')).toHaveValue('Av. Atlântica, 1');

    expect(useMapStore.getState().layers).toHaveLength(1);
    rendered.unmount();
    expect(useMapStore.getState().layers).toEqual([]);
    expect(useMapStore.getState().trace).toBeNull();
    expect(useMapStore.getState().onMarkerClick).toBeUndefined();
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
});
