/**
 * The route/query store.
 *
 * ── Why Zustand rather than context + reducer ────────────────────────────────
 *
 * Two consumers make context awkward here. First, `MapCanvas` drives MapLibre
 * imperatively, outside React's render path — with Zustand it can read
 * `getState()` or subscribe directly, with no provider dance. Second, the result
 * screen has several sibling panels that each care about a different slice; a
 * context value re-renders *every* consumer whenever any field changes, so
 * flipping the active alternative would re-render the plaza list, the fuel tab and
 * the map together. Zustand's selector subscriptions keep each panel to its own
 * slice.
 *
 * The store carries two things the spec asked for: the query and its response
 * (including which alternative is active), and the **layer manager** — the
 * register/toggle surface for named map layers. They live in one store because
 * the layer set is derived from the response, and splitting them would mean two
 * stores that must be kept in step.
 */

import { create } from 'zustand';

import type { ApiError } from '../api/errors';
import type { Place, PlaceInput, PlannedRoute, VehicleProfile } from '../api/types';
import type { MapLayerDescriptor } from '../map/layers';

/** What the user asked for. Kept so the result screen can show it and re-run it. */
export interface PlanQuery {
  readonly origin: PlaceInput;
  readonly destination: PlaceInput;
  readonly waypoints: readonly PlaceInput[];
  readonly vehicle: VehicleProfile;
  readonly fuelPricePerL: number;
  /** Human-readable labels for the origin/destination, for display only. */
  readonly originLabel: string;
  readonly destinationLabel: string;
}

export type PlanStatus = 'idle' | 'loading' | 'ready' | 'error';

/** A layer known to the layer manager, plus whether it is currently drawn. */
export interface LayerState extends MapLayerDescriptor {
  visible: boolean;
}

export interface EndpointMarker {
  readonly id: 'origin' | 'destination' | `waypoint-${number}`;
  readonly kind: 'origin' | 'destination' | 'waypoint';
  readonly label: string;
  readonly place: Place;
}

interface RouteStore {
  query: PlanQuery | null;
  routes: readonly PlannedRoute[];
  /**
   * Which alternative is active. Always a valid index into `routes` when
   * `routes` is non-empty — `setActiveIndex` clamps.
   */
  activeIndex: number;
  status: PlanStatus;
  error: ApiError | null;

  /** The layer manager's registrations, in registration order. */
  layers: readonly LayerState[];
  /** Places picked on Tela 1, kept so the persistent module map can draw them. */
  endpointMarkers: readonly EndpointMarker[];

  startPlanning(query: PlanQuery): void;
  planSucceeded(routes: readonly PlannedRoute[]): void;
  planFailed(error: ApiError): void;
  setActiveIndex(index: number): void;
  reset(): void;

  /** Register a named layer. Idempotent: re-registering keeps current visibility. */
  registerLayer(descriptor: MapLayerDescriptor): void;
  toggleLayer(id: string): void;
  setLayerVisible(id: string, visible: boolean): void;
  setEndpointMarkers(markers: readonly EndpointMarker[]): void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  query: null,
  routes: [],
  activeIndex: 0,
  status: 'idle',
  error: null,
  layers: [],
  endpointMarkers: [],

  startPlanning: (query) => set({ query, status: 'loading', error: null }),

  planSucceeded: (routes) => set({ routes, activeIndex: 0, status: 'ready', error: null }),

  // The previous routes are cleared so a stale trace cannot survive on the map
  // behind an error message.
  planFailed: (error) => set({ error, status: 'error', routes: [], activeIndex: 0 }),

  setActiveIndex: (index) =>
    set((state) => ({
      activeIndex: Math.min(Math.max(index, 0), Math.max(state.routes.length - 1, 0)),
    })),

  reset: () =>
    set({
      query: null,
      routes: [],
      activeIndex: 0,
      status: 'idle',
      error: null,
      endpointMarkers: [],
    }),

  registerLayer: (descriptor) =>
    set((state) => {
      const existing = state.layers.find((layer) => layer.id === descriptor.id);
      if (existing) {
        // Keep what the user chose; only refresh the label.
        return {
          layers: state.layers.map((layer) =>
            layer.id === descriptor.id ? { ...layer, ...descriptor, visible: layer.visible } : layer,
          ),
        };
      }
      return {
        layers: [...state.layers, { ...descriptor, visible: descriptor.defaultVisible ?? true }],
      };
    }),

  toggleLayer: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    })),

  setLayerVisible: (id, visible) =>
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === id ? { ...layer, visible } : layer)),
    })),

  setEndpointMarkers: (endpointMarkers) => set({ endpointMarkers }),
}));

/** The alternative currently selected, or `null` when there is no result. */
export function selectActiveRoute(state: {
  routes: readonly PlannedRoute[];
  activeIndex: number;
}): PlannedRoute | null {
  return state.routes[state.activeIndex] ?? null;
}

/** Whether a named layer is currently drawn. Unknown layers are treated as off. */
export function selectLayerVisible(state: { layers: readonly LayerState[] }, id: string): boolean {
  return state.layers.find((layer) => layer.id === id)?.visible ?? false;
}
