import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Every other `MapCanvas` test runs against `test/maplibre-stub.ts` (wired up
 * globally in `test/setup.ts`), because a real `maplibregl.Map` needs a WebGL
 * context jsdom does not provide. That stub reimplements `Marker.addTo()`
 * from scratch, and its reimplementation never touched `aria-label` — which
 * is exactly how a real regression slipped through: the *actual* MapLibre
 * `Marker.addTo()` (`maplibre-gl/src/ui/marker.ts`) overwrites the element's
 * `aria-label` with a generic `"Marker.Title"` string *after* `MapCanvas`
 * has already set the real one, and the stub silently didn't reproduce that.
 *
 * This file exists to close that hole: it keeps the real, unmodified
 * `Marker` class from `maplibre-gl` (only `Map` is replaced, and only
 * because constructing a real one still needs WebGL) and inspects the
 * actual DOM node MapLibre positions, so it fails if MapLibre's real code —
 * not a stand-in for it — ever loses the accessible name again.
 */

// `maplibre-gl`'s entry module reads `window.URL.createObjectURL` at import
// time (to spin up its worker), which jsdom does not implement.
if (!window.URL.createObjectURL) {
  Object.defineProperty(window.URL, 'createObjectURL', { value: () => 'blob:fake', writable: true });
}

vi.mock('maplibre-gl', async (importOriginal) => {
  // `maplibre-gl`'s bundled `.d.ts` declares `export =`, which TypeScript
  // does not reflect as a `.default` property on `typeof import(...)` even
  // though the real ESM module (and `MapCanvas`'s own `import maplibregl
  // from 'maplibre-gl'`) has one — so this stays loosely typed rather than
  // fighting that mismatch.
  const actual = (await importOriginal()) as Record<string, unknown> & {
    default: Record<string, unknown>;
  };

  // What `Marker._update()` needs back from `map.project(...)`: an object
  // with `.x`/`.y` that supports `_add()` and `round()`. Precision does not
  // matter here — no test in this file asserts marker screen position.
  class FakePoint {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
    _add(other: { x: number; y: number }) {
      return new FakePoint(this.x + other.x, this.y + other.y);
    }
    round() {
      return new FakePoint(Math.round(this.x), Math.round(this.y));
    }
  }

  /**
   * A minimal stand-in for `maplibregl.Map`, covering exactly what
   * `MapCanvas` calls on it plus the extra surface the REAL
   * `Marker.addTo()`/`Marker._update()` reads off the map object it is
   * given (`_getUIString`, `getCanvasContainer`, `loaded`, `isMoving`,
   * `transform`, `terrain`, `project`) — that second list is the contract
   * this test cares about getting right, since it is what makes the real
   * `Marker` code path (where the bug lives) actually run.
   */
  class FakeMap {
    container: HTMLElement;
    private sources = new Map<string, { data: unknown }>();
    private listeners = new Map<string, ((...a: unknown[]) => void)[]>();

    constructor(options: { container: HTMLElement }) {
      this.container = options.container;
      queueMicrotask(() => this.emit('load'));
    }
    on(event: string, handler: (...a: unknown[]) => void) {
      const existing = this.listeners.get(event) ?? [];
      existing.push(handler);
      this.listeners.set(event, existing);
      return this;
    }
    once(event: string, handler: (...a: unknown[]) => void) {
      return this.on(event, handler);
    }
    off() {
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      for (const handler of this.listeners.get(event) ?? []) handler(...args);
    }
    addControl() {}
    resize() {}
    remove() {}
    isStyleLoaded() {
      return true;
    }
    addSource(id: string, spec: { data?: unknown }) {
      this.sources.set(id, { data: spec.data });
    }
    getSource(id: string) {
      const source = this.sources.get(id);
      if (!source) return undefined;
      return {
        setData: (data: unknown) => {
          source.data = data;
        },
        get data() {
          return source.data;
        },
      };
    }
    removeSource(id: string) {
      this.sources.delete(id);
    }
    addLayer() {}
    getLayer() {
      return undefined;
    }
    removeLayer() {}
    fitBounds() {}

    // The real `Marker`'s contract, kept intentionally minimal.
    _getUIString() {
      return 'Map marker';
    }
    getCanvasContainer() {
      return this.container;
    }
    loaded() {
      return true;
    }
    isMoving() {
      return false;
    }
    get transform() {
      return { renderWorldCopies: false };
    }
    get terrain() {
      return null;
    }
    project() {
      return new FakePoint(0, 0);
    }
    getBearing() {
      return 0;
    }
    getPitch() {
      return 0;
    }
  }

  return {
    ...actual,
    default: { ...actual.default, Map: FakeMap },
    Map: FakeMap,
  };
});

const { MapCanvas } = await import('./MapCanvas');

describe('MapCanvas marker accessible name (real MapLibre Marker)', () => {
  it('keeps the real label as aria-label after the real Marker.addTo() runs', async () => {
    render(
      <MapCanvas
        trace={null}
        layers={[
          {
            id: 'tolls',
            label: 'Pedágios',
            visible: true,
            markers: [{ id: 'p1', lng: -46.0, lat: -23.4, label: 'Pedágio Guararema', kind: 'toll' }],
          },
        ]}
      />,
    );

    const button = await screen.findByRole('button', { name: 'Pedágio Guararema' });

    // The real bug: MapLibre's `Marker.addTo()` sets this to its own
    // generic string, clobbering whatever `MapCanvas` had set.
    expect(button.getAttribute('aria-label')).toBe('Pedágio Guararema');
    expect(button.getAttribute('aria-label')).not.toBe('Map marker');
    expect(button.getAttribute('aria-label')).not.toBe('');
    // `title` was never the problem — kept here as a sanity check that this
    // test's marker is the real one `markerElement()` builds.
    expect(button.getAttribute('title')).toBe('Pedágio Guararema');
  });
});
