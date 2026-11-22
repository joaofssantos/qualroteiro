import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { constructedMaps, lastMap, setStubBasemap } from '@/test/maplibre-stub';

import { useMapStore } from './mapStore';

import { MapCanvas } from './MapCanvas';
import type { MapLayerData } from './layers';

const TRACE: [number, number][] = [
  [-46.6333, -23.5505],
  [-45.9, -23.2],
  [-43.1729, -22.9068],
];

const tollLayer = (visible: boolean): MapLayerData & { visible: boolean } => ({
  id: 'tolls',
  label: 'Pedágios',
  visible,
  markers: [
    { id: 'p1', lng: -46.0, lat: -23.4, label: 'Pedágio Guararema', kind: 'toll' },
    { id: 'p2', lng: -44.5, lat: -23.0, label: 'Pedágio Viúva Graça', kind: 'toll' },
  ],
});

describe('MapCanvas', () => {
  it('opens with a Brazil-wide viewport before a route or places are selected', async () => {
    render(<MapCanvas trace={null} layers={[]} />);

    await waitFor(() => expect(lastMap().options['center']).toEqual([-52.5, -14.5]));
    expect(lastMap().options['zoom']).toBe(3.4);
  });

  it('draws the route trace into the map source', async () => {
    render(<MapCanvas trace={TRACE} layers={[]} />);

    await waitFor(() => {
      expect(lastMap().getSource('route')?.data).toEqual({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: TRACE },
      });
    });
  });

  it('fits the viewport to the trace', async () => {
    render(<MapCanvas trace={TRACE} layers={[]} />);

    await waitFor(() => expect(lastMap().fitBoundsCalls.length).toBeGreaterThan(0));
  });

  it('replaces the trace when the active alternative changes', async () => {
    const { rerender } = render(<MapCanvas trace={TRACE} layers={[]} />);
    await waitFor(() => expect(lastMap().getSource('route')).toBeDefined());

    const other: [number, number][] = [
      [-46.6333, -23.5505],
      [-44.0, -22.4],
    ];
    rerender(<MapCanvas trace={other} layers={[]} />);

    await waitFor(() => {
      const data = lastMap().getSource('route')?.data as { geometry: { coordinates: unknown } };
      expect(data.geometry.coordinates).toEqual(other);
    });
  });

  it('adds the markers of a visible layer to the map', async () => {
    render(<MapCanvas trace={TRACE} layers={[tollLayer(true)]} />);

    expect(await screen.findByRole('button', { name: /Pedágio Guararema/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Pedágio Viúva Graça/ })).toBeInTheDocument();
  });

  it('cada pino leva a classe map-pin, que no mobile estende a área de toque a 44 px (index.css)', async () => {
    render(<MapCanvas trace={TRACE} layers={[tollLayer(true)]} />);
    const pin = await screen.findByRole('button', { name: /Pedágio Guararema/ });
    expect(pin).toHaveClass('map-pin');
    const css = readFileSync(join(__dirname, '..', '..', 'index.css'), 'utf8');
    expect(css).toMatch(/\.map-pin::after\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
    expect(css).toMatch(/\.maplibregl-ctrl-group button[^{]*\{[^}]*(width|height):\s*44px/);
  });

  it('removes those markers when the layer is toggled off, and restores them', async () => {
    const { rerender } = render(<MapCanvas trace={TRACE} layers={[tollLayer(true)]} />);
    await screen.findByRole('button', { name: /Pedágio Guararema/ });

    rerender(<MapCanvas trace={TRACE} layers={[tollLayer(false)]} />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Pedágio Guararema/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Pedágio Viúva Graça/ })).not.toBeInTheDocument();
    });

    rerender(<MapCanvas trace={TRACE} layers={[tollLayer(true)]} />);
    expect(await screen.findByRole('button', { name: /Pedágio Guararema/ })).toBeInTheDocument();
  });

  it('reports which marker was clicked', async () => {
    const user = userEvent.setup();
    const onMarkerClick = vi.fn();

    render(<MapCanvas trace={TRACE} layers={[tollLayer(true)]} onMarkerClick={onMarkerClick} />);
    await user.click(await screen.findByRole('button', { name: /Pedágio Viúva Graça/ }));

    expect(onMarkerClick).toHaveBeenCalledWith('tolls', 'p2');
  });

  it('takes its style from VITE_MAP_STYLE_URL, defaulting to a key-free basemap', async () => {
    render(<MapCanvas trace={null} layers={[]} />);

    await waitFor(() => expect(lastMap().options['style']).toBeTruthy());
    expect(String(lastMap().options['style'])).toMatch(/^https:\/\//);
  });

  it('tears the map down on unmount', async () => {
    const { unmount } = render(<MapCanvas trace={TRACE} layers={[]} />);
    await waitFor(() => expect(lastMap()).toBeDefined());
    const map = lastMap();

    unmount();

    expect(map.removed).toBe(true);
  });

  describe('tema, prévia e padding (F3)', () => {
    const setRoute = (route: string) =>
      document.documentElement.style.setProperty('--route', route);

    beforeEach(() => {
      document.documentElement.className = '';
      document.documentElement.removeAttribute('style');
      useMapStore.getState().clearMap();
      setRoute('38 92% 50%');
      document.documentElement.style.setProperty('--route-casing', '209 60% 16%');
      document.documentElement.style.setProperty('--map-water', '212 38% 14%');
    });

    it('troca de tema repinta rota e mapa base sem recriar o Map', async () => {
      setStubBasemap([
        { id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: { 'fill-color': '#0af' } },
      ]);
      render(<MapCanvas trace={TRACE} layers={[]} />);
      await waitFor(() => expect(lastMap().getSource('route')).toBeDefined(), { timeout: 3000 });
      const map = lastMap();
      const calls = map.paintCalls.length;

      act(() => {
        setRoute('38 95% 58%');
        document.documentElement.classList.add('dark');
      });

      await waitFor(
        () => {
          const painted = map.paintCalls.slice(calls);
          expect(painted).toContainEqual({ id: 'route-line', prop: 'line-color', value: 'hsl(38, 95%, 58%)' });
          expect(painted.some((c) => c.id === 'route-casing' && c.prop === 'line-color')).toBe(true);
          expect(painted.some((c) => c.id === 'water' && c.prop === 'fill-color')).toBe(true);
        },
        { timeout: 3000 },
      );
      expect(constructedMaps).toHaveLength(1);
    });

    it('sem rota, a prévia do store é desenhada como camada tracejada', async () => {
      act(() => useMapStore.getState().setMapPreview({ coordinates: TRACE }));
      render(<MapCanvas trace={null} layers={[]} />);

      await waitFor(() => expect(lastMap().getLayer('route-preview')).toBeDefined(), { timeout: 3000 });
      const layer = lastMap().layers.find((l) => l.id === 'route-preview')!;
      expect((layer.spec['paint'] as Record<string, unknown>)['line-dasharray']).toBeTruthy();
      expect((lastMap().getSource('route-preview')?.data as { geometry: { coordinates: unknown } }).geometry.coordinates).toEqual(TRACE);
    });

    it('o padding do store entra no fitBounds', async () => {
      act(() => useMapStore.getState().setMapPadding({ top: 10, right: 20, bottom: 30, left: 416 }));
      render(<MapCanvas trace={TRACE} layers={[]} />);

      await waitFor(() => expect(lastMap().fitBoundsCalls.length).toBeGreaterThan(0), { timeout: 3000 });
      const last = lastMap().fitBoundsCalls.at(-1) as { options: { padding: unknown } };
      expect(last.options.padding).toEqual({ top: 74, right: 84, bottom: 94, left: 480 });
    });

    it('requestFit reenquadra a rota', async () => {
      render(<MapCanvas trace={TRACE} layers={[]} />);
      await waitFor(() => expect(lastMap().fitBoundsCalls.length).toBeGreaterThan(0), { timeout: 3000 });
      const before = lastMap().fitBoundsCalls.length;

      act(() => useMapStore.getState().requestFit());

      await waitFor(() => expect(lastMap().fitBoundsCalls.length).toBeGreaterThan(before), { timeout: 3000 });
    });

    it('pino com index mostra o número e mantém o aria-label; destino é quadrado', async () => {
      const layer: MapLayerData & { visible: boolean } = {
        id: 'tolls',
        label: 'Pedágios',
        visible: true,
        markers: [
          { id: 'p1', lng: -46, lat: -23.4, label: 'Pedágio Guararema', kind: 'toll', index: 2 },
          { id: 'd', lng: -43, lat: -22.9, label: 'Destino Rio', kind: 'destination', index: 3 },
        ],
      };
      render(<MapCanvas trace={TRACE} layers={[layer]} />);

      const toll = await screen.findByRole('button', { name: 'Pedágio Guararema' }, { timeout: 3000 });
      const dest = await screen.findByRole('button', { name: 'Destino Rio' }, { timeout: 3000 });
      expect(toll).toHaveTextContent('2');
      expect(toll.style.borderRadius).toBe('9999px');
      expect(dest).toHaveTextContent('3');
      expect(dest.style.borderRadius).not.toBe('9999px');
    });
  });
});
