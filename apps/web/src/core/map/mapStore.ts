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

export interface MapPadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

interface MapStore {
  /** Marker layers the active module wants drawn. Empty when nothing has published. */
  layers: readonly (MapLayerData & { visible: boolean })[];
  /** The route line to draw, or `null` for nothing. */
  trace: RouteTrace | null;
  /** The live-preview route (F9), drawn dashed while there is no planned `trace`. */
  preview: RouteTrace | null;
  /** Extra room, in px, the map keeps free on each side when fitting (a floating panel, say). */
  padding: MapPadding;
  /** Bumped by `requestFit`; `MapCanvas` re-fits whenever it changes. */
  fitRequest: number;
  /** Called with the layer id and marker id of whatever the user clicked, if anyone is listening. */
  onMarkerClick: MapMarkerClickHandler | undefined;

  setMapLayers(layers: readonly (MapLayerData & { visible: boolean })[]): void;
  setMapTrace(trace: RouteTrace | null): void;
  setMapPreview(preview: RouteTrace | null): void;
  setMapPadding(padding: MapPadding): void;
  requestFit(): void;
  setOnMarkerClick(handler: MapMarkerClickHandler | undefined): void;
  /** Reset every field to its empty default. Call this on unmount — see the module doc above. */
  clearMap(): void;
}

const EMPTY_STATE = {
  layers: [] as readonly (MapLayerData & { visible: boolean })[],
  trace: null as RouteTrace | null,
  onMarkerClick: undefined as MapMarkerClickHandler | undefined,
  preview: null as RouteTrace | null,
  padding: { top: 0, right: 0, bottom: 0, left: 0 } as MapPadding,
};

export const useMapStore = create<MapStore>((set) => ({
  ...EMPTY_STATE,
  // Deliberately outside EMPTY_STATE: a monotonic counter, so `clearMap` can never
  // make a later `requestFit` look like "no change".
  fitRequest: 0,

  setMapLayers: (layers) => set({ layers }),
  setMapTrace: (trace) => set({ trace }),
  setMapPreview: (preview) => set({ preview }),
  setMapPadding: (padding) => set({ padding }),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  setOnMarkerClick: (onMarkerClick) => set({ onMarkerClick }),
  clearMap: () => set({ ...EMPTY_STATE }),
}));
