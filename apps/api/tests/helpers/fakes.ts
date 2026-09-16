/**
 * Test doubles for the two WAVE 1 provider interfaces.
 *
 * These exist to prove the injection seam: they are handed to `buildApp` and
 * the production handlers run against them unmodified. No network, no DB.
 */

import type { GeocodeProvider, LineString, Place } from '@qualroteiro/geo';
import type { RouteRequest, RouteResult, RoutingProvider } from '@qualroteiro/routing';
import { corridorPolyline, dutraCorridor } from '@qualroteiro/tolls';

import type {
  GooglePlacesProvider,
  NearbySearchRequest,
  PlaceResult,
} from '../../src/providers/google-places.js';
import type { ApiUsageStore, UsageCounterSnapshot } from '../../src/store/api-usage.js';
import type {
  TollPlazaRecord,
  TollPlazaStatus,
  TollPlazaStore,
} from '../../src/store/toll-plaza-store.js';

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

/**
 * Somewhere in the Atlantic, well away from any seeded corridor — mirrors the
 * fixture `@qualroteiro/tolls` itself uses to prove a "no match" route.
 */
const OFF_CORRIDOR_GEOMETRY: LineString = {
  type: 'LineString',
  coordinates: [
    [-30, -20],
    [-29, -19],
    [-28, -18],
  ],
};

/**
 * A `RoutingProvider` whose one alternative passes no seeded corridor, so
 * `matchTolls`/`matchFuelStations` both legitimately return empty.
 */
export function offCorridorRoutingProvider(): RoutingProvider {
  return {
    async route(): Promise<RouteResult> {
      return {
        routes: [
          {
            geometry: OFF_CORRIDOR_GEOMETRY,
            distanceKm: 250,
            durationMin: 200,
          },
        ],
      };
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

export interface FakeGooglePlaces extends GooglePlacesProvider {
  /** Every request the handler made, in order — asserted to be EMPTY when the breaker trips. */
  readonly calls: NearbySearchRequest[];
}

/** A `GooglePlacesProvider` returning one fixed result per category, or a caller-supplied list. */
export function fakeGooglePlacesProvider(results?: PlaceResult[]): FakeGooglePlaces {
  const calls: NearbySearchRequest[] = [];
  return {
    calls,
    async searchNearby(req: NearbySearchRequest): Promise<PlaceResult[]> {
      calls.push(req);
      if (results !== undefined) return results;
      return [
        {
          id: `fake-place-${calls.length}`,
          name: 'Pousada Fake',
          address: 'Rua Fake, 123',
          lat: req.lat,
          lng: req.lng,
          category: req.category,
        },
      ];
    },
  };
}

/** A `GooglePlacesProvider` that always fails, to exercise the 502 path. */
export function failingGooglePlacesProvider(error: Error): FakeGooglePlaces {
  const calls: NearbySearchRequest[] = [];
  return {
    calls,
    async searchNearby(req: NearbySearchRequest): Promise<PlaceResult[]> {
      calls.push(req);
      throw error;
    },
  };
}

/**
 * An in-memory {@link ApiUsageStore}.
 *
 * A real implementation of the port's semantics — atomic-in-appearance
 * increment, per (sku, yearMonth) keying — not a stub returning fixtures, so
 * the breaker's route-level tests prove the actual refuse-before-calling
 * ordering and not just a mocked return value.
 */
export function fakeApiUsageStore(
  seed: Readonly<Record<string, number>> = {},
): ApiUsageStore & { readonly rows: Map<string, UsageCounterSnapshot> } {
  const rows = new Map<string, UsageCounterSnapshot>();
  for (const [key, count] of Object.entries(seed)) {
    const [sku, yearMonth] = key.split('|');
    if (sku === undefined || yearMonth === undefined) {
      throw new Error(`fakeApiUsageStore: seed key must be 'sku|yearMonth', got '${key}'`);
    }
    rows.set(key, { sku, yearMonth, count });
  }

  return {
    rows,
    async getCount(sku: string, yearMonth: string): Promise<number> {
      return rows.get(`${sku}|${yearMonth}`)?.count ?? 0;
    },
    async increment(sku: string, yearMonth: string): Promise<UsageCounterSnapshot> {
      const key = `${sku}|${yearMonth}`;
      const next = { sku, yearMonth, count: (rows.get(key)?.count ?? 0) + 1 };
      rows.set(key, next);
      return next;
    },
    async listAll(): Promise<readonly UsageCounterSnapshot[]> {
      return [...rows.values()];
    },
  };
}

/**
 * Real-world-shaped toll plaza records mirroring the Dutra demo corridor's
 * plazas — same ids/coordinates/highway as `@qualroteiro/tolls`'s own seed,
 * but through the T5 Wave 2 store shape (`uf`/`municipality`/`active`/
 * `ingestedAt`, and deliberately NO tariff field). Stands in for what Wave
 * 3's real ANTT ingestion would eventually store for this stretch of
 * BR-116: lets `POST /routes/plan` tests prove the real geometric match
 * against `SP_RJ_GEOMETRY` (itself `corridorPolyline('sp-rj-dutra')`) without
 * going through `@qualroteiro/tolls`'s in-package seed, which the production
 * path no longer reads.
 */
export const DUTRA_TOLL_PLAZA_RECORDS: readonly TollPlazaRecord[] = dutraCorridor.plazas.map(
  (plaza) => ({
    id: plaza.id,
    concessionaire: plaza.concessionaire,
    name: plaza.name,
    highway: plaza.highway,
    uf: 'SP',
    municipality: plaza.name,
    km: plaza.km,
    lat: plaza.lat,
    lng: plaza.lng,
    active: true,
    ingestedAt: new Date('2026-09-01T00:00:00.000Z'),
  }),
);

/**
 * An in-memory {@link TollPlazaStore}.
 *
 * A real implementation of the port's semantics, not a stub: `listActive()`
 * actually filters on `active`, and `status()` actually aggregates `count`/
 * `lastIngestedAt` from whatever records were seeded — so a test seeding an
 * inactive row, or an empty store, exercises the real filtering/aggregation
 * logic rather than a canned return value.
 */
export function fakeTollPlazaStore(
  records: readonly TollPlazaRecord[] = [],
): TollPlazaStore & { readonly records: readonly TollPlazaRecord[] } {
  return {
    records,
    async listActive(): Promise<readonly TollPlazaRecord[]> {
      return records.filter((r) => r.active);
    },
    async status(): Promise<TollPlazaStatus> {
      if (records.length === 0) {
        return { count: 0, lastIngestedAt: null };
      }
      const lastIngestedAt = new Date(Math.max(...records.map((r) => r.ingestedAt.getTime())));
      return { count: records.length, lastIngestedAt };
    },
  };
}
