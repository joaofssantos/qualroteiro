/**
 * Constants shared across the module's screens.
 *
 * Kept out of `index.tsx` so a screen can import the module's own path without
 * importing the component tree that would create an import cycle.
 */

import type { MapLayerDescriptor } from '@/core/map/layers';

/** The module's root path. Owned here, not by the shell. */
export const MODULE_PATH = '/rota-custos';

export const ENDPOINT_LAYER_ID = 'endpoints';
export const TOLL_LAYER_ID = 'tolls';
export const FUEL_STATION_LAYER_ID = 'fuel-stations';

/**
 * The layers this module contributes to the map.
 *
 * `fuel-stations` is declared even though F1 never populates it: the contract
 * guarantees `points.fuelStations` exists and is empty, and having the layer here
 * means the day station data arrives, nothing about the map or the panel changes.
 */
export const ROTA_CUSTOS_LAYERS: readonly MapLayerDescriptor[] = [
  { id: TOLL_LAYER_ID, label: 'Pedágios', defaultVisible: true },
  { id: FUEL_STATION_LAYER_ID, label: 'Postos de combustível', defaultVisible: true },
];
