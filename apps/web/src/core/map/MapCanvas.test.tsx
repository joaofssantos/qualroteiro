import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { lastMap } from '@/test/maplibre-stub';

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
});
