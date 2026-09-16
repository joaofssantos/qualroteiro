/**
 * The shared map channel.
 *
 * `MapCanvas` moved out of `RotaCustosLayout` and up to `AppShell` so it survives
 * navigation between modules instead of tearing down its WebGL context every time
 * the user leaves "Rota & Custos". This store is the mechanism a module — any
 * module, present or future — uses to publish what that persistent map should
 * draw while the module is mounted: `setMapLayers`, `setMapTrace`,
 * `setOnMarkerClick`. `AppShell` reads it to feed `MapCanvas` its props; it never
 * knows what a toll plaza or a hotel is.
 *
 * Deliberately **not** merged into `routeStore`: `routeStore` owns rota-custos's
 * own domain state (the query, the planned alternatives, the plaza layer
 * manager) — a hospedagem or restaurantes module publishing to the map next wave
 * has no business reading or writing any of that. This store only ever holds the
 * map's current *display* state, nothing about why it looks that way.
 *
 * Zustand for the same reason as `routeStore` (see that file): `MapCanvas` reads
 * outside React's render path, so a plain context would force a provider dance
 * `MapCanvas` — mounted once, at the shell — has no natural place to sit inside.
 *
 * **The cleanup contract**: a module that publishes to this store MUST call
 * `clearMap()` in the cleanup of the effect that published (`useEffect(() => ()
 * => clearMap(), [clearMap])`, or equivalent). Nothing here clears automatically
 * on route change — the shell keeps one `MapCanvas` instance alive across
 * modules precisely so it does NOT reset on its own, which is exactly what would
 * make the map survive navigation. Skipping the cleanup call is how one module's
 * markers would leak into the next module's map.
 */

import { create } from 'zustand';

import type { MapLayerData, RouteTrace } from './layers';

export type MapMarkerClickHandler = (layerId: string, markerId: string) => void;

interface MapStore {
  /** Marker layers the active module wants drawn. Empty when nothing has published. */
  layers: readonly (MapLayerData & { visible: boolean })[];
  /** The route line to draw, or `null` for nothing. */
  trace: RouteTrace | null;
  /** Called with the layer id and marker id of whatever the user clicked, if anyone is listening. */
  onMarkerClick: MapMarkerClickHandler | undefined;

  setMapLayers(layers: readonly (MapLayerData & { visible: boolean })[]): void;
  setMapTrace(trace: RouteTrace | null): void;
  setOnMarkerClick(handler: MapMarkerClickHandler | undefined): void;
  /** Reset every field to its empty default. Call this on unmount — see the module doc above. */
  clearMap(): void;
}

const EMPTY_STATE = {
  layers: [] as readonly (MapLayerData & { visible: boolean })[],
  trace: null as RouteTrace | null,
  onMarkerClick: undefined as MapMarkerClickHandler | undefined,
};

export const useMapStore = create<MapStore>((set) => ({
  ...EMPTY_STATE,

  setMapLayers: (layers) => set({ layers }),
  setMapTrace: (trace) => set({ trace }),
  setOnMarkerClick: (onMarkerClick) => set({ onMarkerClick }),
  clearMap: () => set({ ...EMPTY_STATE }),
}));
