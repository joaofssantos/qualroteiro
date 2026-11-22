import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useLayoutStore } from '@/core/layout/layoutStore';
import { useRouteStore } from '@/core/store/routeStore';
import { useRouteDraftStore } from '@/modules/rota-custos/routeDraftStore';
import { constructedMaps } from '@/test/maplibre-stub';
import { DUTRA_ROUTE, PLAN_QUERY_FIXTURE } from '@/test/fixtures';
import { renderApp, resetApp } from '@/test/renderApp';

beforeEach(() => {
  window.localStorage.clear();
  resetApp();
});

afterEach(() => {
  cleanup();
  resetApp();
});

describe('ShellB (integração, MapLibre stub)', () => {
  it('troca A→B→A com consulta preenchida: campos preservados e Map construído 1×', async () => {
    useRouteDraftStore.getState().setOrigin({ text: 'São Paulo', place: null });
    renderApp('/rota-custos');
    await screen.findByLabelText('Origem', undefined, { timeout: 3000 });
    expect(constructedMaps).toHaveLength(1);

    act(() => useLayoutStore.getState().setLayout('b'));
    expect(await screen.findByTestId('shell-b', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByLabelText('Origem', undefined, { timeout: 3000 })).toHaveValue('São Paulo');
    expect(screen.getByTestId('query-form')).toHaveAttribute('data-variant', 'hero');
    expect(constructedMaps).toHaveLength(1);
    expect(constructedMaps[0]!.removed).toBe(false);

    act(() => useLayoutStore.getState().setLayout('a'));
    await screen.findByLabelText('Origem', undefined, { timeout: 3000 });
    expect(screen.queryByTestId('shell-b')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Origem')).toHaveValue('São Paulo');
    expect(constructedMaps).toHaveLength(1);
  });

  it('B renderiza o resultado como página, com um único mapa', async () => {
    useLayoutStore.setState({ layout: 'b' });
    useRouteStore.setState({ query: PLAN_QUERY_FIXTURE, routes: [DUTRA_ROUTE], activeIndex: 0, status: 'ready' });
    renderApp('/rota-custos/resultado');

    expect(await screen.findByTestId('map-card', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Comparação de alternativas' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Mapa da rota' })).toHaveLength(1);
    expect(constructedMaps).toHaveLength(1);
  });

  it('a barra superior usa a cor de sidebar (app-sidebar): no escuro o logo não some sobre o primário claro', async () => {
    useLayoutStore.setState({ layout: 'b' });
    renderApp('/rota-custos');

    const [topBar] = await screen.findAllByRole('banner', undefined, { timeout: 3000 });
    expect(topBar).toHaveClass('app-sidebar');
  });
});
