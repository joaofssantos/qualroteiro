import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMapStore } from '@/core/map/mapStore';
import type { Place, PlaceResult } from '@/core/api/types';
import { mockApi, renderApp, resetApp } from '@/test/renderApp';

const RIO: Place = { id: 'rio', label: 'Rio de Janeiro, RJ', lng: -43.1729, lat: -22.9068 };
const MUSEUM: PlaceResult = {
  id: 'museum',
  name: 'Museu do Amanhã',
  address: 'Praça Mauá, Rio de Janeiro - RJ',
  lng: -43.1809,
  lat: -22.8942,
  category: 'atividades',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockNearbyApi(nearbyResponse: () => Response = () => json({ places: [MUSEUM] })) {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/places/search')) return json({ places: [RIO] });
    if (url.startsWith('/api/places/nearby')) return nearbyResponse();
    throw new Error(`unexpected request in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

async function searchNearRio(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByRole('combobox', { name: 'Buscar perto de' }), 'Rio');
  const option = await screen.findByRole('option', { name: /Rio de Janeiro, RJ/ });
  await user.click(option);
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetApp();
});

describe('Atividades module', () => {
  it('appears in the generated nav and calculates live without network', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi();

    renderApp('/atividades');

    expect(screen.getByRole('link', { name: 'Atividades' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atividades' })).toBeInTheDocument();
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Preço/pessoa'));
    await user.type(screen.getByLabelText('Preço/pessoa'), '100');
    await user.clear(screen.getByLabelText('Nº de pessoas'));
    await user.type(screen.getByLabelText('Nº de pessoas'), '4');

    expect(screen.getByText('R$ 400,00')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('marks the search card so the compact map panel can keep a single grid column', () => {
    mockApi();
    renderApp('/atividades');

    expect(screen.getByText('Encontrar atividade').closest('.activity-search-card')).toBeInTheDocument();
  });

  it('shows a validation message instead of a total when the input is invalid', async () => {
    const user = userEvent.setup();
    mockApi();

    renderApp('/atividades');

    await user.clear(screen.getByLabelText('Nº de pessoas'));
    await user.type(screen.getByLabelText('Nº de pessoas'), '0');

    expect(screen.getByText('Informe pelo menos uma pessoa.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nº de pessoas')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nº de pessoas')).toHaveAttribute(
      'aria-describedby',
      'activity-people-error',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Informe pelo menos uma pessoa.');
  });

  it('searches nearby activities from a resolved reference and uses a list selection in the form', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockNearbyApi();

    renderApp('/atividades');
    await searchNearRio(user);

    const result = await screen.findByRole('button', {
      name: /Museu do Amanhã Praça Mauá, Rio de Janeiro - RJ/,
    });
    expect(
      fetchSpy.mock.calls.some(
        ([url]) =>
          String(url) ===
          '/api/places/nearby?lat=-22.9068&lng=-43.1729&category=atividades',
      ),
    ).toBe(true);

    await user.click(result);

    expect(screen.getByLabelText('Nome do lugar')).toHaveValue(MUSEUM.name);
    expect(screen.getByLabelText('Endereço')).toHaveValue(MUSEUM.address);
    expect(screen.queryByRole('list', { name: 'Atividades encontradas' })).not.toBeInTheDocument();
    expect(useMapStore.getState().layers[0]?.markers).toEqual([
      expect.objectContaining({ id: MUSEUM.id, label: MUSEUM.name }),
    ]);

    const referenceInput = screen.getByRole('combobox', { name: 'Buscar perto de' });
    await user.clear(referenceInput);
    await searchNearRio(user);
    expect(await screen.findByRole('list', { name: 'Atividades encontradas' })).toBeInTheDocument();
  });

  it('uses the shared-map marker handler to select the same activity', async () => {
    const user = userEvent.setup();
    mockNearbyApi();

    renderApp('/atividades');
    await searchNearRio(user);
    await screen.findByText(MUSEUM.address);

    act(() => useMapStore.getState().onMarkerClick?.('atividade-lugares', MUSEUM.id));

    expect(screen.getByLabelText('Nome do lugar')).toHaveValue(MUSEUM.name);
    expect(screen.getByLabelText('Endereço')).toHaveValue(MUSEUM.address);
  });

  it('keeps the manual calculator available when nearby search fails', async () => {
    const user = userEvent.setup();
    mockNearbyApi(() => json({ error: 'Google Places provider failed' }, 502));

    renderApp('/atividades');
    await searchNearRio(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Você pode preencher os dados manualmente');

    await user.clear(screen.getByLabelText('Preço/pessoa'));
    await user.type(screen.getByLabelText('Preço/pessoa'), '100');
    await user.clear(screen.getByLabelText('Nº de pessoas'));
    await user.type(screen.getByLabelText('Nº de pessoas'), '4');

    expect(screen.getByText('R$ 400,00')).toBeInTheDocument();
  });

  it('shows an empty state and clears the shared map store after unmount', async () => {
    const user = userEvent.setup();
    mockNearbyApi(() => json({ places: [] }));

    const rendered = renderApp('/atividades');
    await searchNearRio(user);

    expect(await screen.findByText('Nenhuma atividade encontrada nesta região.')).toBeInTheDocument();
    expect(useMapStore.getState().layers).toHaveLength(1);

    // Unmount directly rather than navigating to a sibling `showMap: true`
    // module: Hospedagem and Restaurantes both publish their own `layers`
    // (even an empty array) synchronously on their own mount, which would
    // overwrite whatever Atividades left behind regardless of whether its
    // own `clearMap()` cleanup ran — masking exactly the gap this test
    // exists to catch (the same failure mode G2's QA gate found).
    rendered.unmount();

    expect(useMapStore.getState().layers).toEqual([]);
    expect(useMapStore.getState().trace).toBeNull();
    expect(useMapStore.getState().onMarkerClick).toBeUndefined();
  });
});
