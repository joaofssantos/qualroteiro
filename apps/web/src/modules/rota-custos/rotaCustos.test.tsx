/**
 * The "Rota & Custos" module, end to end, with only the network faked.
 *
 * These are the acceptance criteria for the wave, written as tests: the flow from
 * Tela 1 to Tela 2, the alternatives, the layer toggle, the plaza drawer, and the
 * `400`/`422` distinction.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { constructedMaps, lastMap } from '@/test/maplibre-stub';
import {
  ALTERNATIVE_ROUTE,
  DUTRA_PLAZAS,
  DUTRA_ROUTE,
  RIO_DE_JANEIRO,
  SAO_PAULO,
} from '@/test/fixtures';
import { type ApiMock, mockApi, renderApp, resetApp } from '@/test/renderApp';

const ORIGIN = 'São Paulo, SP';
const DESTINATION = 'Rio de Janeiro, RJ';

const firstPlaza = DUTRA_PLAZAS[0]!;

/** Fill Tela 1 with the acceptance scenario and submit it. */
async function planFromForm(mock: ApiMock) {
  const fetchSpy = mockApi(mock);
  const user = userEvent.setup();
  renderApp();

  await user.type(screen.getByLabelText('Origem'), ORIGIN);
  await user.type(screen.getByLabelText('Destino'), DESTINATION);
  await user.click(screen.getByRole('button', { name: /calcular rota/i }));

  return { user, fetchSpy };
}

async function pickPlace(label: string, typed: string, option: RegExp) {
  const input = screen.getByLabelText(label);
  const user = userEvent.setup();
  await user.clear(input);
  await user.type(input, typed);
  await user.click(await screen.findByRole('option', { name: option }));
}

async function planFromSelectedPlaces(mock: ApiMock) {
  const fetchSpy = mockApi({
    places: [SAO_PAULO, RIO_DE_JANEIRO],
    ...mock,
  });
  const user = userEvent.setup();
  renderApp();

  await user.type(screen.getByLabelText('Origem'), 'São');
  await user.click(await screen.findByRole('option', { name: /São Paulo/ }));
  await user.type(screen.getByLabelText('Destino'), 'Rio');
  await user.click(await screen.findByRole('option', { name: /Rio de Janeiro/ }));
  await user.click(screen.getByRole('button', { name: /calcular rota/i }));

  return { user, fetchSpy };
}

/** The panel region on Tela 2, so queries do not accidentally match the map. */
function panel() {
  return within(screen.getByRole('complementary', { name: /custos da rota/i }));
}

/**
 * The summary row only.
 *
 * Scoped deliberately: the Alternativas tab also lists each alternative's
 * distance and toll total, so a bare `getByText('429,7 km')` would match either
 * the summary or a list entry and an assertion about "the summary changed" could
 * pass while the summary had not moved at all.
 */
function summary() {
  return within(screen.getByTestId('route-summary'));
}

/**
 * The map region only.
 *
 * Marker queries must be scoped: a plaza appears both as a marker on the map and
 * as a row in the Pedágios list, and both are buttons carrying the plaza's name.
 * Scoping is what makes "the marker is on the map" a claim about the map.
 */
function map() {
  return within(screen.getByRole('region', { name: /mapa da rota/i }));
}

beforeEach(() => {
  resetApp();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetApp();
});

describe('Tela 1 — nova consulta', () => {
  it('shows selected origin and destination markers before submitting', async () => {
    const fetchSpy = mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO], routes: [DUTRA_ROUTE] });
    renderApp();

    expect(screen.getByRole('region', { name: /mapa da rota/i })).toBeInTheDocument();

    await pickPlace('Origem', 'São', /São Paulo/);
    await pickPlace('Destino', 'Rio', /Rio de Janeiro/);

    expect(map().getByRole('button', { name: /Origem: São Paulo/ })).toBeInTheDocument();
    expect(map().getByRole('button', { name: /Destino: Rio de Janeiro/ })).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('/routes/plan'))).toHaveLength(
      0,
    );

    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as {
        geometry: { coordinates: unknown[] };
      };
      expect(data.geometry.coordinates).toEqual([]);
    });
  });

  it('submits the contract body and shows the result screen', async () => {
    const { fetchSpy } = await planFromForm({ routes: [DUTRA_ROUTE] });

    await screen.findByRole('heading', { name: /resultado da rota/i });

    const planCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/routes/plan'));
    expect(planCall).toBeDefined();
    const body = JSON.parse(String((planCall?.[1] as RequestInit).body));
    // Free text the user did not pick from the dropdown is sent as a string —
    // the contract accepts it and the server geocodes it.
    expect(body.origin).toBe(ORIGIN);
    expect(body.destination).toBe(DESTINATION);
    expect(body.vehicle).toEqual({ type: 'car', axleCategory: 'car', consumptionKmPerL: 10 });
    expect(body.fuelPricePerL).toBe(6);
  });

  it('refuses to submit without an origin and a destination', async () => {
    const fetchSpy = mockApi({ routes: [DUTRA_ROUTE] });
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /calcular rota/i }));

    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/routes/plan'))).toHaveLength(0);
    expect(await screen.findByText(/informe a origem/i)).toBeInTheDocument();
  });
});

describe('Tela 2 — resultado', () => {
  it('keeps the same map container when the result screen opens', async () => {
    const { fetchSpy } = await planFromSelectedPlaces({ routes: [DUTRA_ROUTE] });
    const mapContainer = screen.getByTestId('rota-custos-map-container');

    await screen.findByRole('heading', { name: /resultado da rota/i });

    expect(screen.getByTestId('rota-custos-map-container')).toBe(mapContainer);
    expect(constructedMaps).toHaveLength(1);

    const planCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/routes/plan'));
    const body = JSON.parse(String((planCall?.[1] as RequestInit).body));
    expect(body.origin).toEqual({ lng: SAO_PAULO.lng, lat: SAO_PAULO.lat });
    expect(body.destination).toEqual({ lng: RIO_DE_JANEIRO.lng, lat: RIO_DE_JANEIRO.lat });
  });

  it('draws the route trace on the map', async () => {
    await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as {
        geometry: { coordinates: unknown[] };
      };
      expect(data.geometry.coordinates).toEqual(DUTRA_ROUTE.geometry.coordinates);
    });
  });

  it('populates the summary row', async () => {
    await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    expect(summary().getByText('429,7 km')).toBeInTheDocument();
    expect(summary().getByText('5 h 43 min')).toBeInTheDocument();
    expect(summary().getByText('R$ 52,90')).toBeInTheDocument();
    expect(summary().getByText('R$ 257,82')).toBeInTheDocument();
  });

  it('lists every plaza with its tariff for the selected axle category', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await user.click(panel().getByRole('tab', { name: /pedágios/i }));

    const list = within(await screen.findByRole('list', { name: /praças de pedágio/i }));
    expect(list.getAllByRole('listitem')).toHaveLength(DUTRA_PLAZAS.length);

    const entry = within(list.getAllByRole('listitem')[0]!);
    expect(entry.getByText(firstPlaza.name)).toBeInTheDocument();
    expect(entry.getByText(new RegExp(firstPlaza.concessionaire))).toBeInTheDocument();
    expect(entry.getByText(new RegExp(firstPlaza.highway))).toBeInTheDocument();
    // The tariff shown is the car column, because the form's default is "car".
    const carTariff = firstPlaza.tariffByAxleCategory.car;
    expect(entry.getByText(`R$ ${carTariff.toFixed(2).replace('.', ',')}`)).toBeInTheDocument();
  });

  it('shows litres, price and cost on the fuel tab, and the cost is litres × price', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await user.click(panel().getByRole('tab', { name: /combustível/i }));

    const fuel = within(await screen.findByTestId('fuel-panel'));
    expect(fuel.getByText('42,97 L')).toBeInTheDocument();
    expect(fuel.getByTestId('fuel-price')).toHaveTextContent('6,00');
    // 42.97 L × R$ 6,00 = R$ 257,82 — the number the API returned.
    expect(fuel.getByTestId('fuel-cost')).toHaveTextContent('257,82');
    expect(DUTRA_ROUTE.fuel.liters * 6).toBeCloseTo(DUTRA_ROUTE.fuel.cost, 2);
  });

  it('renders the fuel-stations section with an empty state, since F1 has no station data', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await user.click(panel().getByRole('tab', { name: /pontos na rota/i }));

    expect(await screen.findByText(/sem dados de postos nesta fase/i)).toBeInTheDocument();
  });
});

describe('Alternativas', () => {
  it('selecting the second alternative changes the trace and every summary number', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE, ALTERNATIVE_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    expect(summary().getByText('429,7 km')).toBeInTheDocument();

    await user.click(panel().getByRole('tab', { name: /alternativas/i }));
    const options = await screen.findAllByRole('radio');
    expect(options).toHaveLength(2);
    await user.click(options[1]!);

    // The summary follows the selection...
    await waitFor(() => {
      expect(summary().getByText('512,4 km')).toBeInTheDocument();
    });
    expect(summary().getByText('7 h 11 min')).toBeInTheDocument();
    expect(summary().getByText('R$ 18,40')).toBeInTheDocument();
    expect(summary().getByText('R$ 307,44')).toBeInTheDocument();
    expect(summary().queryByText('429,7 km')).not.toBeInTheDocument();

    // ...and so does the map.
    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as {
        geometry: { coordinates: unknown[] };
      };
      expect(data.geometry.coordinates).toEqual(ALTERNATIVE_ROUTE.geometry.coordinates);
    });
  });
});

describe('Pontos na rota — layer toggling', () => {
  it('toggling the toll layer removes and restores its markers on the map', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await user.click(panel().getByRole('tab', { name: /pontos na rota/i }));

    // Markers are on the map by default.
    expect(map().getByRole('button', { name: new RegExp(firstPlaza.name) })).toBeInTheDocument();

    const toggle = await screen.findByRole('switch', { name: /pedágios/i });

    await user.click(toggle);
    await waitFor(() => {
      expect(map().queryByRole('button', { name: new RegExp(firstPlaza.name) })).toBeNull();
    });

    await user.click(toggle);
    await waitFor(() => {
      expect(map().getByRole('button', { name: new RegExp(firstPlaza.name) })).toBeInTheDocument();
    });
  });
});

describe('Tela 3 — detalhe da praça', () => {
  it('opens a drawer with the plaza data when a plaza is clicked in the list', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await user.click(panel().getByRole('tab', { name: /pedágios/i }));
    const list = await screen.findByRole('list', { name: /praças de pedágio/i });
    await user.click(within(list).getAllByRole('button')[0]!);

    const drawer = within(await screen.findByRole('dialog'));
    expect(drawer.getByRole('heading', { name: firstPlaza.name })).toBeInTheDocument();
    expect(drawer.getByText(firstPlaza.concessionaire)).toBeInTheDocument();
    expect(drawer.getByText(firstPlaza.highway)).toBeInTheDocument();
    // Every axle category's tariff, not just the selected one.
    expect(drawer.getAllByRole('row').length).toBeGreaterThanOrEqual(8);
  });

  it('opens the same drawer when the plaza marker on the map is clicked', async () => {
    const { user } = await planFromForm({ routes: [DUTRA_ROUTE] });
    await screen.findByRole('heading', { name: /resultado da rota/i });

    await user.click(map().getByRole('button', { name: new RegExp(firstPlaza.name) }));

    const drawer = within(await screen.findByRole('dialog'));
    expect(drawer.getByRole('heading', { name: firstPlaza.name })).toBeInTheDocument();
  });
});

describe('error handling', () => {
  it('pins a 422 to the field the API named, as an address problem', async () => {
    await planFromForm({
      planResponse: () =>
        new Response(JSON.stringify({ error: "destination: no place found for 'Rio de Janiro'" }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        }),
    });

    const destination = await screen.findByLabelText('Destino');
    await waitFor(() => expect(destination).toHaveAttribute('aria-invalid', 'true'));

    // The message is about the address, attached to the destination field...
    const describedBy = destination.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent ?? '').toMatch(
      /endereço não encontrado/i,
    );

    // ...and the origin, which was fine, is not marked invalid.
    expect(screen.getByLabelText('Origem')).not.toHaveAttribute('aria-invalid', 'true');
    // It is not reported as a generic form failure.
    expect(screen.queryByText(/confira os campos destacados/i)).not.toBeInTheDocument();
    // And we stayed on Tela 1 so the user can fix it.
    expect(screen.queryByRole('heading', { name: /resultado da rota/i })).not.toBeInTheDocument();
  });

  it('shows the generic validation path for a 400', async () => {
    await planFromForm({
      planResponse: () =>
        new Response(JSON.stringify({ error: 'vehicle.consumptionKmPerL must be > 0' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    });

    expect(await screen.findByText(/confira os campos destacados/i)).toBeInTheDocument();
    // A 400 is not an address problem, so the destination is not flagged as one.
    expect(screen.getByLabelText('Destino')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('reports an upstream failure as such', async () => {
    await planFromForm({
      planResponse: () =>
        new Response(JSON.stringify({ error: 'routing provider failed' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }),
    });

    expect(await screen.findByText(/serviço de rotas está indisponível/i)).toBeInTheDocument();
  });

  it('handles a 200 with no alternatives', async () => {
    await planFromForm({ routes: [] });

    expect(await screen.findByText(/nenhuma rota encontrada/i)).toBeInTheDocument();
  });
});
