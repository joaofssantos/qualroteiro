/**
 * The demo dataset: four cities and the three seeded corridors, plus the pure
 * helpers that resolve free text / coordinates to them and assemble a
 * `PlannedRoute`.
 *
 * Everything geographic and monetary is delegated to the WAVE 1 packages —
 * `@qualroteiro/tolls` owns the corridor polylines, the plazas and `matchTolls`;
 * `@qualroteiro/fuel` owns `estimateFuel`. This module only wires them together
 * and pins the demo-grade distance/duration constants.
 */

import { haversineMeters } from '@qualroteiro/geo';
import { estimateFuel } from '@qualroteiro/fuel';
import { getCorridor, matchTolls } from '@qualroteiro/tolls';
import type { CorridorId } from '@qualroteiro/tolls';

import type { LineString, PlaceInput, Place, PlannedRoute, PlanRouteRequest } from '../types';

/** Lowercase and strip diacritics, so "São Paulo" and "sao paulo" compare equal. */
const COMBINING_MARKS = /\p{Diacritic}/gu;

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

export interface DemoCity {
  readonly place: Place;
  /** Extra free-text fragments (already normalised) that resolve to this city. */
  readonly aliases: readonly string[];
}

/**
 * The four cities the demo knows. Coordinates are the corridor endpoints from
 * the `@qualroteiro/tolls` seed, so a picked hit lands exactly on the polyline.
 */
export const DEMO_CITIES: readonly DemoCity[] = [
  {
    place: { id: 'demo-sao-paulo', label: 'São Paulo, SP', lng: -46.6333, lat: -23.5505, kind: 'city' },
    aliases: ['sao paulo'],
  },
  {
    place: { id: 'demo-rio-de-janeiro', label: 'Rio de Janeiro, RJ', lng: -43.1729, lat: -22.9068, kind: 'city' },
    aliases: ['rio de janeiro'],
  },
  {
    place: { id: 'demo-curitiba', label: 'Curitiba, PR', lng: -49.2733, lat: -25.4284, kind: 'city' },
    aliases: ['curitiba'],
  },
  {
    place: { id: 'demo-campinas', label: 'Campinas, SP', lng: -47.0608, lat: -22.9099, kind: 'city' },
    aliases: ['campinas'],
  },
];

/**
 * `GET /places/search?q=` behaviour: case-insensitive substring match on the
 * label (the contract's rule). A blank query is the caller's problem — this
 * returns `[]` for it and the handler answers `400`.
 */
export function searchDemoCities(q: string): readonly Place[] {
  const needle = normalizeText(q);
  if (needle === '') return [];
  return DEMO_CITIES.filter((c) => normalizeText(c.place.label).includes(needle)).map(
    (c) => c.place,
  );
}

/** A coordinate this far (m) from a city's centre still resolves to that city. */
const COORD_MATCH_METERS = 25_000;

/**
 * Resolve an origin/destination — a free-text string or `{ lng, lat }` — to one
 * of the four demo cities, or `null` when nothing matches.
 */
export function resolveDemoCity(input: PlaceInput): DemoCity | null {
  if (typeof input === 'string') {
    const needle = normalizeText(input);
    if (needle === '') return null;
    return (
      DEMO_CITIES.find((c) => {
        const label = normalizeText(c.place.label);
        return (
          label.includes(needle) ||
          needle.includes(label) ||
          c.aliases.some((a) => needle.includes(a) || a.includes(needle))
        );
      }) ?? null
    );
  }
  return (
    DEMO_CITIES.find(
      (c) => haversineMeters({ lng: c.place.lng, lat: c.place.lat }, input) <= COORD_MATCH_METERS,
    ) ?? null
  );
}

export interface DemoCorridor {
  readonly corridorId: CorridorId;
  readonly originCityId: string;
  readonly destinationCityId: string;
  /** Demo-grade constant (km). Adjust toward the seed if it ever carries distances. */
  readonly distanceKm: number;
  /** Demo-grade constant (min). */
  readonly durationMin: number;
}

/** The three seeded corridors, in their seed direction (São Paulo is the origin). */
export const DEMO_CORRIDORS: readonly DemoCorridor[] = [
  {
    corridorId: 'sp-rj-dutra',
    originCityId: 'demo-sao-paulo',
    destinationCityId: 'demo-rio-de-janeiro',
    distanceKm: 429.7,
    durationMin: 342.5,
  },
  {
    corridorId: 'sp-curitiba-regis-bittencourt',
    originCityId: 'demo-sao-paulo',
    destinationCityId: 'demo-curitiba',
    distanceKm: 408,
    durationMin: 352,
  },
  {
    corridorId: 'sp-campinas-bandeirantes',
    originCityId: 'demo-sao-paulo',
    destinationCityId: 'demo-campinas',
    distanceKm: 96,
    durationMin: 82,
  },
];

/** Find the corridor connecting two city ids, in either direction. */
export function findDemoCorridor(
  originCityId: string,
  destinationCityId: string,
): { spec: DemoCorridor; reversed: boolean } | null {
  const forward = DEMO_CORRIDORS.find(
    (c) => c.originCityId === originCityId && c.destinationCityId === destinationCityId,
  );
  if (forward) return { spec: forward, reversed: false };
  const backward = DEMO_CORRIDORS.find(
    (c) => c.originCityId === destinationCityId && c.destinationCityId === originCityId,
  );
  if (backward) return { spec: backward, reversed: true };
  return null;
}

/**
 * Assemble one `PlannedRoute` for a corridor, exactly the shape
 * `POST /routes/plan` returns.
 *
 * - `geometry` — the seed's reference polyline, reversed for the return trip.
 * - `tolls` — the **real `matchTolls`** over that geometry with the request's
 *   axle category, restricted to this corridor; `total` is the sum of the
 *   selected-category tariffs (matchTolls computes it in integer centavos).
 * - `fuel` — the **real `estimateFuel`** with the request's distance,
 *   consumption and price.
 * - `points.tolls` — the matched plazas; `points.fuelStations` — always `[]`
 *   (the seed has no station data; the contract keeps the field).
 */
export function buildPlannedRoute(
  spec: DemoCorridor,
  reversed: boolean,
  request: PlanRouteRequest,
): PlannedRoute {
  const corridor = getCorridor(spec.corridorId);
  const geometry: LineString = reversed
    ? { type: 'LineString', coordinates: [...corridor.referencePolyline.coordinates].reverse() }
    : corridor.referencePolyline;

  const { axleCategory, consumptionKmPerL } = request.vehicle;

  const { plazas, total } = matchTolls({
    routeGeometry: geometry,
    axleCategory,
    corridorHint: spec.corridorId,
  });

  const fuel = estimateFuel({
    distanceKm: spec.distanceKm,
    consumptionKmPerL,
    pricePerL: request.fuelPricePerL,
  });

  return {
    geometry,
    distanceKm: spec.distanceKm,
    durationMin: spec.durationMin,
    tolls: { plazas, total },
    fuel: { liters: fuel.liters, cost: fuel.cost },
    points: { tolls: plazas, fuelStations: [] },
  };
}
