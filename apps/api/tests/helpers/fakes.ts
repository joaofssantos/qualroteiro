/**
 * Test doubles for the two WAVE 1 provider interfaces.
 *
 * These exist to prove the injection seam: they are handed to `buildApp` and
 * the production handlers run against them unmodified. No network, no DB.
 */

import type { GeocodeProvider, LineString, Place } from '@qualroteiro/geo';
import type { RouteRequest, RouteResult, RoutingProvider } from '@qualroteiro/routing';
import { corridorPolyline } from '@qualroteiro/tolls';

/**
 * A plausible São Paulo → Rio de Janeiro alternative.
 *
 * The geometry is the toll seed's OWN reference trace for the Dutra corridor,
 * so `matchTolls` runs its real 500 m geometric match against it and the toll
 * assertions exercise actual geometry rather than a stubbed number.
 */
export const SP_RJ_GEOMETRY: LineString = corridorPolyline('sp-rj-dutra');

export const SP_RJ_DISTANCE_KM = 429.7;
export const SP_RJ_DURATION_MIN = 342.5;

export interface FakeRouting extends RoutingProvider {
  /** Every request the handler made, in order — lets a test assert on resolved coords. */
  readonly calls: RouteRequest[];
}

/** A `RoutingProvider` that returns one fixed SP→RJ alternative. */
export function fakeRoutingProvider(result?: RouteResult): FakeRouting {
  const calls: RouteRequest[] = [];
  return {
    calls,
    async route(req: RouteRequest): Promise<RouteResult> {
      calls.push(req);
      return (
        result ?? {
          routes: [
            {
              geometry: SP_RJ_GEOMETRY,
              distanceKm: SP_RJ_DISTANCE_KM,
              durationMin: SP_RJ_DURATION_MIN,
            },
          ],
        }
      );
    },
  };
}

/** A `RoutingProvider` that always fails, to exercise the 502 path. */
export function failingRoutingProvider(error: Error): RoutingProvider {
  return {
    async route(): Promise<RouteResult> {
      throw error;
    },
  };
}

export interface FakeGeocode extends GeocodeProvider {
  readonly queries: string[];
}

/** A `GeocodeProvider` returning one hit per query, or a caller-supplied list. */
export function fakeGeocodeProvider(places?: Place[]): FakeGeocode {
  const queries: string[] = [];
  return {
    queries,
    async search(q: string): Promise<Place[]> {
      queries.push(q);
      if (places !== undefined) return places;
      return [
        {
          id: `fake-${queries.length}`,
          label: q,
          lng: -46.6333,
          lat: -23.5505,
          kind: 'city',
        },
      ];
    },
  };
}

export function failingGeocodeProvider(error: Error): GeocodeProvider {
  return {
    async search(): Promise<Place[]> {
      throw error;
    },
  };
}
