/**
 * Toll domain types.
 *
 * Types and data shapes only — no I/O of any kind.
 */

import type { LineString } from '@qualroteiro/geo';

/**
 * Vehicle tariff class.
 *
 * Follows the Brazilian convention of pricing by axle count and wheel type
 * (rodagem simples vs. dupla) rather than by vehicle model.
 */
export type AxleCategory =
  | 'motorcycle'
  | 'car'
  | 'car_with_trailer'
  | 'truck_2_axle'
  | 'truck_3_axle'
  | 'truck_4_axle'
  | 'truck_5_axle'
  | 'truck_6_axle';

/** Every {@link AxleCategory}, in ascending order of cost. */
export const AXLE_CATEGORIES = [
  'motorcycle',
  'car',
  'car_with_trailer',
  'truck_2_axle',
  'truck_3_axle',
  'truck_4_axle',
  'truck_5_axle',
  'truck_6_axle',
] as const satisfies readonly AxleCategory[];

/** A tariff in BRL for each axle category. */
export type TariffByAxleCategory = Readonly<Record<AxleCategory, number>>;

/** A physical toll plaza. */
export interface TollPlaza {
  /** Stable, human-readable identifier, unique across the whole seed. */
  readonly id: string;
  /** The plaza's common name, as signposted. */
  readonly name: string;
  /** The company operating the concession at this plaza. */
  readonly concessionaire: string;
  /** The highway the plaza sits on, e.g. `'BR-116'`, `'SP-348'`. */
  readonly highway: string;
  /**
   * Distance along the corridor from the corridor's origin, in kilometres.
   *
   * NOT the highway's official DNIT/DER kilometrage — corridor-relative
   * kilometres are what the "points on route" panel needs, and they stay
   * consistent when a corridor crosses a state line and the official
   * kilometrage restarts.
   */
  readonly km: number;
  readonly lat: number;
  readonly lng: number;
  readonly tariffByAxleCategory: TariffByAxleCategory;
}

/** The corridors carried by the seed dataset. */
export type CorridorId =
  | 'sp-rj-dutra'
  | 'sp-curitiba-regis-bittencourt'
  | 'sp-campinas-bandeirantes';

/** A named highway stretch: its plazas plus a reference polyline. */
export interface Corridor {
  readonly id: CorridorId;
  readonly name: string;
  readonly highway: string;
  readonly concessionaires: readonly string[];
  /**
   * A coarse demo trace of the corridor, origin to destination.
   *
   * Exists so `matchTolls` and its tests have a route to work against before a
   * real routing provider is wired in. It is NOT a survey-grade geometry — see
   * the package README.
   */
  readonly referencePolyline: LineString;
  /** The corridor's plazas, ordered by increasing {@link TollPlaza.km}. */
  readonly plazas: readonly TollPlaza[];
}
