import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '@/core/layout/layoutStore';
import { MapSlot } from '@/core/layout/MapHost';
import { useRouteStore } from '@/core/store/routeStore';
import { useRouteDraftStore } from '@/modules/rota-custos/routeDraftStore';
import { constructedMaps } from '@/test/maplibre-stub';
import { renderApp, resetApp } from '@/test/renderApp';

vi.unmock('@/core/layout/shellLoaders');

vi.mock('./layouts/a', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell-a">
      <MapSlot data-testid="slot-a" />
      {children}
    </div>
  ),
}));
vi.mock('./layouts/b', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="shell-b">
      <MapSlot data-testid="slot-b" />
      {children}
    </section>
  ),
}));

// O shell B de mentira já posiciona o mapa; a consulta real do B tem o próprio MapSlot,
// e só um slot pode ficar ativo por vez. Aqui a consulta do B vira um stub.
vi.mock('@/modules/rota-custos/layoutB/ConsultaHero', () => ({
  ConsultaHero: () => <div data-testid="hero-stub" />,
}));

beforeEach(() => {
  window.localStorage.clear();
  resetApp();
});

afterEach(() => {
  cleanup();
  resetApp();
});

describe('AppShell layout selector', () => {
  it.each([
    ['a', 'shell-a'],
    ['b', 'shell-b'],
  ] as const)('renders the %s shell', async (layout, testId) => {
    useLayoutStore.setState({ layout });
    renderApp('/rota-custos');

    expect(await screen.findByTestId(testId, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('keeps one map, its DOM node, the draft and the result when switching A→B→A', async () => {
    useRouteDraftStore.getState().setOrigin({ text: 'São Paulo', place: null });
    useRouteStore.setState({ status: 'ready' });
    renderApp('/rota-custos');

    await screen.findByTestId('shell-a', undefined, { timeout: 3000 });
    const mapRegion = screen.getByRole('region', { name: 'Mapa da rota' });
    expect(screen.getByTestId('slot-a')).toContainElement(mapRegion);
    expect(constructedMaps).toHaveLength(1);
    const resizesBefore = constructedMaps[0]!.resizeCalls;

    act(() => useLayoutStore.getState().setLayout('b'));
    await screen.findByTestId('shell-b', undefined, { timeout: 3000 });

    expect(screen.getByTestId('slot-b')).toContainElement(mapRegion);
    expect(screen.queryByTestId('shell-a')).not.toBeInTheDocument();
    expect(useRouteDraftStore.getState().origin.text).toBe('São Paulo');
    expect(useRouteStore.getState().status).toBe('ready');
    expect(constructedMaps).toHaveLength(1);
    expect(constructedMaps[0]!.removed).toBe(false);
    expect(constructedMaps[0]!.resizeCalls).toBeGreaterThan(resizesBefore);

    act(() => useLayoutStore.getState().setLayout('a'));
    await screen.findByTestId('shell-a', undefined, { timeout: 3000 });

    expect(screen.getByTestId('slot-a')).toContainElement(screen.getByRole('region', { name: 'Mapa da rota' }));
    expect(screen.getByRole('region', { name: 'Mapa da rota' })).toBe(mapRegion);
    expect(constructedMaps).toHaveLength(1);
  });
});
