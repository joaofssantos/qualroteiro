/**
 * `VITE_DEMO_MODE` end to end.
 *
 * The whole app — real shell, registry, router, store — with demo mode forced on
 * and **no `fetch`/network mock at all**. A throwing sentinel stands in for
 * `fetch` so any accidental network call fails the test loudly.
 *
 * This is the acceptance for the wave: a static bundle with the flag on must
 * plan the three seeded corridors from fixtures and never touch the network.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from '@/core/shell/AppRouter';
import { PlaceSearch, type PlaceFieldValue } from '@/core/components/PlaceSearch';
import { registerAppModules } from '@/modules';
import { lastMap } from '@/test/maplibre-stub';
import { resetApp } from '@/test/renderApp';
import { useState } from 'react';

import { setDemoModeForTests } from './mode';
import { getCorridor } from '@qualroteiro/tolls';

/** `fetch` must never run in demo mode. */
function installNoNetworkSentinel() {
  const sentinel = vi.fn(() => {
    throw new Error('network call attempted while VITE_DEMO_MODE is on');
  });
  vi.stubGlobal('fetch', sentinel);
  return sentinel;
}

function renderAppOnly(initialPath = '/rota-custos') {
  registerAppModules();
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

function panel() {
  return within(screen.getByRole('complementary', { name: /custos da rota/i }));
}
function summary() {
  return within(screen.getByTestId('route-summary'));
}

async function planFromForm(origin: string, destination: string) {
  const user = userEvent.setup();
  renderAppOnly();
  await user.type(screen.getByLabelText('Origem'), origin);
  await user.type(screen.getByLabelText('Destino'), destination);
  await user.click(screen.getByRole('button', { name: /calcular rota/i }));
  return user;
}

beforeEach(() => {
  resetApp();
  setDemoModeForTests(true);
});

afterEach(() => {
  setDemoModeForTests(undefined);
  vi.unstubAllGlobals();
  resetApp();
});

describe('demo mode — Tela 1 -> Tela 2, no network', () => {
  it('plans SP -> RJ (Dutra) from fixtures: trace, summary, tolls, fuel', async () => {
    const sentinel = installNoNetworkSentinel();
    const user = await planFromForm('São Paulo, SP', 'Rio de Janeiro, RJ');

    await screen.findByRole('heading', { name: /resultado da rota/i });

    // Route trace on the map is the seed's Dutra polyline.
    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as { geometry: { coordinates: unknown[] } };
      expect(data.geometry.coordinates).toEqual(
        getCorridor('sp-rj-dutra').referencePolyline.coordinates,
      );
    });

    // Summary populated.
    expect(summary().getByText('429,7 km')).toBeInTheDocument();
    expect(summary().getByText('5 h 43 min')).toBeInTheDocument();

    // Pedágios tab: at least one Dutra plaza with a tariff.
    await user.click(panel().getByRole('tab', { name: /pedágios/i }));
    const list = within(await screen.findByRole('list', { name: /praças de pedágio/i }));
    const items = list.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    const first = getCorridor('sp-rj-dutra').plazas[0]!;
    expect(within(items[0]!).getByText(first.name)).toBeInTheDocument();
    expect(
      within(items[0]!).getByText(
        `R$ ${first.tariffByAxleCategory.car.toFixed(2).replace('.', ',')}`,
      ),
    ).toBeInTheDocument();

    // Combustível tab: cost = liters × price = 429.7 / 10 * 6.
    await user.click(panel().getByRole('tab', { name: /combustível/i }));
    const fuel = within(await screen.findByTestId('fuel-panel'));
    expect(fuel.getByText('42,97 L')).toBeInTheDocument();
    expect(fuel.getByTestId('fuel-cost')).toHaveTextContent('257,82');

    expect(sentinel).not.toHaveBeenCalled();
  });

  it('plans SP -> Curitiba (Régis Bittencourt) from fixtures', async () => {
    const sentinel = installNoNetworkSentinel();
    const user = await planFromForm('São Paulo, SP', 'Curitiba, PR');

    await screen.findByRole('heading', { name: /resultado da rota/i });
    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as { geometry: { coordinates: unknown[] } };
      expect(data.geometry.coordinates).toEqual(
        getCorridor('sp-curitiba-regis-bittencourt').referencePolyline.coordinates,
      );
    });
    expect(summary().getByText('408,0 km')).toBeInTheDocument();

    await user.click(panel().getByRole('tab', { name: /pedágios/i }));
    const list = within(await screen.findByRole('list', { name: /praças de pedágio/i }));
    expect(list.getAllByRole('listitem').length).toBe(
      getCorridor('sp-curitiba-regis-bittencourt').plazas.length,
    );

    await user.click(panel().getByRole('tab', { name: /combustível/i }));
    // 408 / 10 * 6 = 244.80
    expect(within(screen.getByTestId('fuel-panel')).getByTestId('fuel-cost')).toHaveTextContent(
      '244,80',
    );
    expect(sentinel).not.toHaveBeenCalled();
  });

  it('plans SP -> Campinas (Bandeirantes) from fixtures', async () => {
    const sentinel = installNoNetworkSentinel();
    const user = await planFromForm('São Paulo, SP', 'Campinas, SP');

    await screen.findByRole('heading', { name: /resultado da rota/i });
    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as { geometry: { coordinates: unknown[] } };
      expect(data.geometry.coordinates).toEqual(
        getCorridor('sp-campinas-bandeirantes').referencePolyline.coordinates,
      );
    });
    expect(summary().getByText('96,0 km')).toBeInTheDocument();

    await user.click(panel().getByRole('tab', { name: /pedágios/i }));
    const list = within(await screen.findByRole('list', { name: /praças de pedágio/i }));
    expect(list.getAllByRole('listitem').length).toBe(
      getCorridor('sp-campinas-bandeirantes').plazas.length,
    );

    await user.click(panel().getByRole('tab', { name: /combustível/i }));
    // 96 / 10 * 6 = 57.60
    expect(within(screen.getByTestId('fuel-panel')).getByTestId('fuel-cost')).toHaveTextContent(
      '57,60',
    );
    expect(sentinel).not.toHaveBeenCalled();
  });
});

describe('demo mode — the "modo demonstração" badge', () => {
  it('renders in the shell when the flag is on', () => {
    installNoNetworkSentinel();
    renderAppOnly();
    expect(screen.getByText(/modo demonstração/i)).toBeInTheDocument();
  });

  it('is absent when the flag is off', () => {
    setDemoModeForTests(false);
    renderAppOnly();
    expect(screen.queryByText(/modo demonstração/i)).not.toBeInTheDocument();
  });
});

describe('demo mode — PlaceSearch resolves the seeded cities offline', () => {
  function Harness() {
    const [value, setValue] = useState<PlaceFieldValue>({ text: '', place: null });
    return <PlaceSearch id="origin" label="Origem" value={value} onChange={setValue} />;
  }

  it('offers the four fixture cities without touching the network', async () => {
    const sentinel = installNoNetworkSentinel();
    const user = userEvent.setup();
    render(<Harness />);

    for (const [typed, label] of [
      ['São', 'São Paulo, SP'],
      ['Rio', 'Rio de Janeiro, RJ'],
      ['Curi', 'Curitiba, PR'],
      ['Campi', 'Campinas, SP'],
    ] as const) {
      await user.clear(screen.getByLabelText('Origem'));
      await user.type(screen.getByLabelText('Origem'), typed);
      expect(await screen.findByRole('option', { name: new RegExp(label) })).toBeInTheDocument();
    }

    expect(sentinel).not.toHaveBeenCalled();
  });
});

describe('demo mode off — the client still hits the network', () => {
  it('planRoute calls fetch(/api/routes/plan) when the flag is off', async () => {
    setDemoModeForTests(false);
    const spy = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ routes: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    const { planRoute } = await import('../client');
    await planRoute({
      origin: { lng: -46.6, lat: -23.5 },
      destination: 'Rio de Janeiro, RJ',
      waypoints: [],
      vehicle: { type: 'car', axleCategory: 'car', consumptionKmPerL: 10 },
      fuelPricePerL: 6,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![0])).toBe('/api/routes/plan');
  });
});
