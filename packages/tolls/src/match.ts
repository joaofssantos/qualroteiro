/**
 * Geometric matching of toll plazas and fuel stations to a route.
 *
 * Pure functions, no I/O. `matchTolls` takes its candidate plazas explicitly
 * from the caller (they may come from the in-package demo seed, a real-world
 * store, or anywhere else); `matchFuelStations` still resolves its own
 * candidates from the in-package seed via `corridorHint` — deliberately left
 * as-is in this phase, which only touches toll matching.
 */

import type { LineString } from '@qualroteiro/geo';
import { nearestPointOnLine } from '@qualroteiro/geo';

import type { AxleCategory, Corridor, CorridorId, FuelStationSeed, TollPlaza } from './types.js';
import { getCorridor, listCorridors } from './seed/index.js';

/**
 * How close a plaza must be to the route polyline to count as "on the route",
 * in metres.
 *
 * 500 m is wide enough to absorb the coarseness of a demo reference polyline
 * and the geometry simplification every routing vendor applies, yet narrow
 * enough that a tolled highway running parallel to the route does not falsely
 * claim a plaza. Overridable per call via {@link MatchTollsInput.bufferMeters}.
 */
export const TOLL_MATCH_BUFFER_METERS = 500;

/** Input to {@link matchTolls}. */
export interface MatchTollsInput {
  /** The route to test, as a GeoJSON LineString. */
  readonly routeGeometry: LineString;
  /** The vehicle class whose tariff should be summed. */
  readonly axleCategory: AxleCategory;
  /**
   * The candidate plazas to test against the route.
   *
   * The caller assembles this list — `matchTolls` no longer resolves
   * candidates itself from the in-package seed. This keeps the function
   * agnostic to where plazas come from: the demo seed (`listCorridors()`),
   * a real-world store, or any other source a caller wants to test.
   */
  readonly plazas: readonly TollPlaza[];
  /** Override the matching buffer. Defaults to {@link TOLL_MATCH_BUFFER_METERS}. */
  readonly bufferMeters?: number;
}

/** Result of {@link matchTolls}. */
export interface MatchTollsResult {
  /** The matched plazas, ordered by their position along the route. */
  readonly plazas: readonly TollPlaza[];
  /** Sum of the matched plazas' tariffs for the requested axle category, in BRL. */
  readonly total: number;
}

/**
 * Find the toll plazas a route passes, and what they cost.
 *
 * A plaza belongs to the route when its point lies within
 * {@link TOLL_MATCH_BUFFER_METERS} of the route polyline. Matched plazas are
 * returned in the order the route meets them, which is what the "points on
 * route" panel renders.
 *
 * The total is accumulated in integer centavos and converted back at the end,
 * so summing six fares cannot drift by floating-point accumulation. A matched
 * plaza with no `tariffByAxleCategory` (a real-world plaza ingested without a
 * fare yet — see {@link TollPlaza}) still appears in {@link
 * MatchTollsResult.plazas}, but contributes nothing to the total.
 *
 * @throws {RangeError} for an empty route geometry or a non-positive buffer.
 */
export function matchTolls(input: MatchTollsInput): MatchTollsResult {
  const { routeGeometry, axleCategory, plazas, bufferMeters = TOLL_MATCH_BUFFER_METERS } = input;

  if (routeGeometry.coordinates.length === 0) {
    throw new RangeError('matchTolls: routeGeometry has no coordinates');
  }
  if (!Number.isFinite(bufferMeters) || bufferMeters <= 0) {
    throw new RangeError(
      `matchTolls: bufferMeters must be a positive finite number, received ${bufferMeters}`,
    );
  }

  const matched: { plaza: TollPlaza; fractionAlong: number }[] = [];

  for (const plaza of plazas) {
    const nearest = nearestPointOnLine({ lng: plaza.lng, lat: plaza.lat }, routeGeometry);
    if (nearest.distanceMeters <= bufferMeters) {
      matched.push({ plaza, fractionAlong: nearest.fractionAlong });
    }
  }

  matched.sort((a, b) => a.fractionAlong - b.fractionAlong);

  const totalCentavos = matched.reduce(
    (sum, { plaza }) =>
      sum + Math.round((plaza.tariffByAxleCategory?.[axleCategory] ?? 0) * 100),
    0,
  );

  return {
    plazas: matched.map(({ plaza }) => plaza),
    total: totalCentavos / 100,
  };
}

/** Input to {@link matchFuelStations}. */
export interface MatchFuelStationsInput {
  /** The route to test, as a GeoJSON LineString. */
  readonly routeGeometry: LineString;
  /**
   * Restrict the search to a single corridor.
   *
   * An optimisation and a disambiguator, not a filter on the result: without
   * it, every seeded station is tested against the route.
   */
  readonly corridorHint?: CorridorId;
  /** Override the matching buffer. Defaults to {@link TOLL_MATCH_BUFFER_METERS}. */
  readonly bufferMeters?: number;
}

/** Result of {@link matchFuelStations}. */
export interface MatchFuelStationsResult {
  /** The matched stations, ordered by their position along the route. */
  readonly stations: readonly FuelStationSeed[];
}

/**
 * Find the fuel stations a route passes.
 *
 * A station belongs to the route when its point lies within
 * {@link TOLL_MATCH_BUFFER_METERS} of the route polyline — the same buffer and
 * approach as {@link matchTolls}, reused here rather than diverged from since
 * nothing about this demo dataset calls for a different tolerance. Matched
 * stations are returned in the order the route meets them, which is what the
 * "points on route" panel renders. A corridor with no seeded `fuelStations`
 * (or none matched) contributes nothing.
 *
 * @throws {RangeError} for an empty route geometry, a non-positive buffer, or
 * an unknown `corridorHint`.
 */
export function matchFuelStations(input: MatchFuelStationsInput): MatchFuelStationsResult {
  const { routeGeometry, corridorHint, bufferMeters = TOLL_MATCH_BUFFER_METERS } = input;

  if (routeGeometry.coordinates.length === 0) {
    throw new RangeError('matchFuelStations: routeGeometry has no coordinates');
  }
  if (!Number.isFinite(bufferMeters) || bufferMeters <= 0) {
    throw new RangeError(
      `matchFuelStations: bufferMeters must be a positive finite number, received ${bufferMeters}`,
    );
  }

  const candidates: readonly Corridor[] =
    corridorHint === undefined ? listCorridors() : [getCorridor(corridorHint)];

  const matched: { station: FuelStationSeed; fractionAlong: number }[] = [];

  for (const corridor of candidates) {
    for (const station of corridor.fuelStations ?? []) {
      const nearest = nearestPointOnLine({ lng: station.lng, lat: station.lat }, routeGeometry);
      if (nearest.distanceMeters <= bufferMeters) {
        matched.push({ station, fractionAlong: nearest.fractionAlong });
      }
    }
  }

  matched.sort((a, b) => a.fractionAlong - b.fractionAlong);

  return {
    stations: matched.map(({ station }) => station),
  };
}
