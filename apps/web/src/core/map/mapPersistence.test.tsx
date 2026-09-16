/**
 * The shared map channel's extensibility, proven the same way
 * `core/registry/extensibility.test.tsx` proves the module registry: a module
 * declared and registered **entirely inside this file** publishes to the
 * persistent map without `AppShell`, `RotaCustosLayout` or any other core file
 * being edited to make it work.
 *
 * `rotaCustos.test.tsx` already proves the map correctly draws a real route
 * trace, toll/fuel-station layers and reopens `PlazaDrawer` on a marker click —
 * this file is about the *mechanism* itself: any `showMap: true` module can
 * publish to the one `MapCanvas` the shell owns, a module with `showMap` absent
 * gets no map panel at all, the store clears when a module unmounts so nothing
 * it published bleeds into the next module, and two `showMap: true` modules
 * navigated between never see each other's markers.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { registerModule, resetRegistry } from '@/core/registry/registry';
import type { ModuleDefinition } from '@/core/registry/types';
import { AppRouter } from '@/core/shell/AppRouter';
import { type EndpointMarker, useRouteStore } from '@/core/store/routeStore';
import { registerAppModules } from '@/modules';
import { SAO_PAULO } from '@/test/fixtures';

import { useMapStore } from './mapStore';

/** A module a future developer might write: it just wants a map. */
function FakeMapPanel() {
  const setMapLayers = useMapStore((s) => s.setMapLayers);
  const clearMap = useMapStore((s) => s.clearMap);

  useEffect(() => {
    setMapLayers([
      {
        id: 'fake-points',
        label: 'Pontos fake',
        visible: true,
        markers: [{ id: 'fake-1', lng: -46.6, lat: -23.5, label: 'Marcador fake', kind: 'waypoint' }],
      },
    ]);
    // The cleanup contract `mapStore` documents: nothing published here should
    // survive navigating away from this module.
    return () => clearMap();
  }, [setMapLayers, clearMap]);

  return <h1>Painel do módulo com mapa</h1>;
}

const fakeMapModule: ModuleDefinition = {
  id: 'fake-map',
  label: 'Mapa Fake',
  path: '/fake-map',
  Panel: FakeMapPanel,
  showMap: true,
};

const noMapModule: ModuleDefinition = {
  id: 'sem-mapa',
  label: 'Sem Mapa',
  path: '/sem-mapa',
  Panel: () => <h1>Painel sem mapa</h1>,
};

function mapRegion() {
  return screen.queryByRole('region', { name: /mapa da rota/i });
}

afterEach(() => {
  resetRegistry();
  useMapStore.getState().clearMap();
  useRouteStore.getState().reset();
});

describe('mapa persistente — extensibilidade', () => {
  it('lets a showMap:true module publish real markers to the shared map, with no core file edited to make it work', async () => {
    registerModule(fakeMapModule);

    render(
      <MemoryRouter initialEntries={['/fake-map']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Painel do módulo com mapa' }),
    ).toBeInTheDocument();

    const region = mapRegion();
    expect(region).toBeInTheDocument();
    expect(within(region!).getByRole('button', { name: 'Marcador fake' })).toBeInTheDocument();
  });

  it('renders no map panel for a module without showMap, and leaves no marker behind after leaving a map module', async () => {
    const user = userEvent.setup();
    registerModule(fakeMapModule);
    registerModule(noMapModule);

    render(
      <MemoryRouter initialEntries={['/fake-map']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Marcador fake' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Sem Mapa' }));

    expect(await screen.findByRole('heading', { name: 'Painel sem mapa' })).toBeInTheDocument();
    // No map region at all — this module's layout is unchanged, full width,
    // exactly like every module before this unit.
    expect(mapRegion()).not.toBeInTheDocument();

    // And navigating back does not resurrect a stale marker from before.
    await user.click(screen.getByRole('link', { name: 'Mapa Fake' }));
    expect(await screen.findByRole('button', { name: 'Marcador fake' })).toBeInTheDocument();
  });

  it('does not mix markers between two showMap:true modules navigated between (rota-custos + the fake module)', async () => {
    const user = userEvent.setup();
    registerAppModules(); // the real app, including rotaCustosModule (showMap: true)
    registerModule(fakeMapModule);

    // A real endpoint marker, set directly rather than through the plan flow —
    // this test is about the map channel, not rota-custos's own business logic
    // (rotaCustos.test.tsx already proves that end to end).
    const endpointMarker: EndpointMarker = {
      id: 'origin',
      kind: 'origin',
      label: `Origem: ${SAO_PAULO.label}`,
      place: SAO_PAULO,
    };
    useRouteStore.getState().setEndpointMarkers([endpointMarker]);

    render(
      <MemoryRouter initialEntries={['/rota-custos']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Origem: São Paulo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcador fake' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Mapa Fake' }));

    expect(await screen.findByRole('button', { name: 'Marcador fake' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Origem: São Paulo/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Rota & Custos' }));

    expect(await screen.findByRole('button', { name: /Origem: São Paulo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcador fake' })).not.toBeInTheDocument();
  });
});
