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

/**
 * Published tariffs in BRL by axle category.
 *
 * A source may omit a category it does not publish.  In particular, an
 * omitted motorcycle tariff is different from a published R$ 0,00 tariff:
 * the former is unknown while the latter is explicitly free.  Consumers must
 * therefore treat a missing category as unavailable rather than as zero.
 */
export type TariffByAxleCategory = Readonly<Partial<Record<AxleCategory, number>>>;

/** Origin of a real-world toll record when it is known to the matcher. */
export type TollPlazaSource = 'antt' | 'osm' | 'artesp';

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
  /** Source of a persisted plaza. Optional so the curated demo seed remains source-agnostic. */
  readonly source?: TollPlazaSource;
  /**
   * The plaza's fare table, by {@link AxleCategory}.
   *
   * Optional: real-world plazas ingested from the ANTT dataset (Wave 3) carry
   * location and identity but not yet a tariff — per-concessionaire fare
   * scraping is a separate, future phase. A plaza with no tariff still
   * matches and appears in {@link TollPlaza} results; it is simply excluded
   * from the cost total. Every plaza in the in-package demo seed carries one.
   */
  readonly tariffByAxleCategory?: TariffByAxleCategory;
}

/**
 * A single toll-booth node as reported by OpenStreetMap (`barrier=toll_booth`).
 *
 * One OSM node is one physical booth/lane, not one toll plaza — a real plaza
 * has several lanes, each its own node. {@link clusterTollBooths} groups these
 * into plaza candidates; {@link parseOsmCharge} turns `chargeTag` (OSM's raw
 * `charge` tag value) into a {@link TariffByAxleCategory}.
 */
export interface OsmTollBooth {
  /** The OSM node id. Stable across queries unless the node is deleted/replaced. */
  readonly id: number;
  readonly lat: number;
  readonly lng: number;
  /** OSM's `operator` tag — the concessionaire running this booth. */
  readonly operator: string;
  /** OSM's raw `charge` tag value, if present. Feed it to {@link parseOsmCharge}. */
  readonly chargeTag?: string;
}

/**
 * A toll-plaza candidate formed by clustering nearby {@link OsmTollBooth}
 * nodes that share an `operator` (see {@link clusterTollBooths}).
 */
export interface TollPlazaCluster {
  /**
   * Natural key: `osm-<smallest booth id in the cluster>`. OSM node ids are
   * stable between queries, and taking the smallest makes the key
   * deterministic regardless of input order.
   */
  readonly id: string;
  readonly operator: string;
  /**
   * The cluster's representative point: the lat/lng of the booth with the
   * smallest id (same node that names the cluster), not a computed centroid.
   * See {@link clusterTollBooths} for why.
   */
  readonly lat: number;
  readonly lng: number;
  /** Every booth id folded into this cluster, ascending, smallest first. */
  readonly boothIds: readonly number[];
  /** The representative booth's `chargeTag`, carried through for {@link parseOsmCharge}. */
  readonly chargeTag?: string;
}

/** A fuel station along a corridor. */
export interface FuelStationSeed {
  /** Stable, human-readable identifier, unique across the whole seed. */
  readonly id: string;
  /** The station's common name, as signposted. */
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
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
  /**
   * The corridor's fuel stations, if any are seeded.
   *
   * Optional so it is additive over the existing plaza-only corridors — a
   * corridor with no seeded stations behaves as if this were `[]`.
   */
  readonly fuelStations?: readonly FuelStationSeed[];
}
