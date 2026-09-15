/**
 * A stand-in for `maplibre-gl` under jsdom.
 *
 * MapLibre needs a WebGL context, which jsdom does not have, so the real library
 * cannot be exercised in a unit test. Rather than mock `MapCanvas` itself — which
 * would prove nothing about the component under test — this stub implements the
 * slice of MapLibre's API that `MapCanvas` actually calls, and records what it was
 * asked to do.
 *
 * The important design choice is {@link StubMarker}: `addTo()` genuinely appends
 * the marker's element into the map's container element, and `remove()` genuinely
 * detaches it. Because `MapCanvas` builds each marker from a real DOM node, marker
 * assertions in tests are ordinary Testing Library queries against the document —
 * `getByRole('button', { name: /Praça/ })` — and clicking one is a real click.
 * "Toggling a layer adds/removes markers on the map" is therefore observable the
 * same way a user would observe it.
 */

export interface StubSource {
  setData(data: unknown): void;
  /** The last data handed to this source — what the map is currently drawing. */
  readonly data: unknown;
}

type Listener = (...args: unknown[]) => void;

class Source implements StubSource {
  data: unknown;

  constructor(spec: { data?: unknown }) {
    this.data = spec.data;
  }

  setData(data: unknown): void {
    this.data = data;
  }
}

export class StubMap {
  readonly container: HTMLElement;
  readonly options: Record<string, unknown>;
  readonly sources = new Map<string, Source>();
  readonly layers: { id: string; spec: Record<string, unknown> }[] = [];
  readonly fitBoundsCalls: unknown[] = [];
  removed = false;
  style: unknown;

  private readonly listeners = new Map<string, Listener[]>();

  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.container = options['container'] as HTMLElement;
    this.style = options['style'];
    // The real map emits `load` once the style resolves. Fire it on a microtask
    // so subscribers registered right after construction still see it.
    queueMicrotask(() => this.emit('load'));
  }

  on(event: string, handler: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(handler);
    this.listeners.set(event, existing);
    return this;
  }

  once(event: string, handler: Listener): this {
    return this.on(event, handler);
  }

  off(event: string, handler: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      existing.filter((h) => h !== handler),
    );
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) handler(...args);
  }

  addSource(id: string, spec: { data?: unknown }): void {
    this.sources.set(id, new Source(spec));
  }

  getSource(id: string): StubSource | undefined {
    return this.sources.get(id);
  }

  removeSource(id: string): void {
    this.sources.delete(id);
  }

  addLayer(spec: Record<string, unknown>): void {
    this.layers.push({ id: spec['id'] as string, spec });
  }

  getLayer(id: string): unknown {
    return this.layers.find((l) => l.id === id);
  }

  removeLayer(id: string): void {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index >= 0) this.layers.splice(index, 1);
  }

  setPaintProperty(): void {}
  setLayoutProperty(): void {}
  addControl(): void {}
  resize(): void {}

  fitBounds(bounds: unknown, options?: unknown): void {
    this.fitBoundsCalls.push({ bounds, options });
  }

  isStyleLoaded(): boolean {
    return true;
  }

  remove(): void {
    this.removed = true;
  }
}

export class StubMarker {
  readonly element: HTMLElement;
  lngLat: { lng: number; lat: number } | null = null;
  private map: StubMap | null = null;

  constructor(options?: { element?: HTMLElement }) {
    this.element = options?.element ?? document.createElement('div');
  }

  setLngLat(position: [number, number] | { lng: number; lat: number }): this {
    this.lngLat = Array.isArray(position) ? { lng: position[0], lat: position[1] } : position;
    return this;
  }

  addTo(map: StubMap): this {
    this.map = map;
    map.container.appendChild(this.element);
    return this;
  }

  remove(): this {
    this.element.remove();
    this.map = null;
    return this;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}

export class StubLngLatBounds {
  readonly positions: [number, number][] = [];

  extend(position: [number, number] | { lng: number; lat: number }): this {
    this.positions.push(
      Array.isArray(position) ? position : [position.lng, position.lat],
    );
    return this;
  }

  isEmpty(): boolean {
    return this.positions.length === 0;
  }
}

export class StubNavigationControl {}

/** Every map constructed since the last {@link resetMapStubs}. */
export const constructedMaps: StubMap[] = [];

/** The most recently constructed map — what a single-map test wants. */
export function lastMap(): StubMap {
  const map = constructedMaps.at(-1);
  if (!map) throw new Error('no MapLibre map has been constructed');
  return map;
}

export function resetMapStubs(): void {
  constructedMaps.length = 0;
}

class TrackedMap extends StubMap {
  constructor(options: Record<string, unknown>) {
    super(options);
    constructedMaps.push(this);
  }
}

/** The module shape `vi.mock('maplibre-gl', ...)` substitutes. */
export const maplibreStub = {
  Map: TrackedMap,
  Marker: StubMarker,
  LngLatBounds: StubLngLatBounds,
  NavigationControl: StubNavigationControl,
  default: {
    Map: TrackedMap,
    Marker: StubMarker,
    LngLatBounds: StubLngLatBounds,
    NavigationControl: StubNavigationControl,
  },
};
