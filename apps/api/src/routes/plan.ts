/**
 * `POST /routes/plan` — the F1 composition endpoint.
 *
 * Resolves place inputs, asks the injected `RoutingProvider` for alternatives,
 * and decorates each one with tolls (`@qualroteiro/tolls`) and fuel
 * (`@qualroteiro/fuel`). It reimplements neither.
 */

import type { FastifyInstance } from 'fastify';
import type { GeocodeProvider, LineString, LngLat } from '@qualroteiro/geo';
import type { RouteAlternative, RoutingProvider } from '@qualroteiro/routing';
import {
  AXLE_CATEGORIES,
  type FuelStationSeed,
  type TariffByAxleCategory,
  type TollPlaza,
  matchFuelStations,
  matchTolls,
} from '@qualroteiro/tolls';
import { estimateFuel } from '@qualroteiro/fuel';

import { ProviderError, UnresolvedPlaceError } from '../errors.js';
import { type PlaceInput, type PlanRequestInput, parsePlanRequest } from '../http/validate.js';
import type { TollPlazaRecord, TollPlazaStore } from '../store/toll-plaza-store.js';

/**
 * A fuel station on the "points on route" panel — `{id, name, lng, lat}`.
 * Alias of `@qualroteiro/tolls`'s `FuelStationSeed`, which already carries
 * exactly this shape; kept as a local name so `apps/api`'s public surface
 * doesn't leak the tolls package's internal naming.
 */
export type FuelStation = FuelStationSeed;

/** One route alternative plus its costs — the unit `apps/web` renders. */
export interface PlannedRoute {
  readonly geometry: LineString;
  readonly distanceKm: number;
  readonly durationMin: number;
  readonly tolls: { readonly plazas: readonly TollPlaza[]; readonly total: number };
  readonly fuel: { readonly liters: number; readonly cost: number };
  readonly points: {
    readonly tolls: readonly TollPlaza[];
    /**
     * Real-matched against `@qualroteiro/tolls`'s seeded stations, same
     * geometric approach as `points.tolls`. Still demo-seed data, not
     * real-world — empty for a route matching no seeded corridor. See
     * spec.md "Deliberate limitations".
     */
    readonly fuelStations: readonly FuelStation[];
  };
}

export interface PlanRouteDeps {
  readonly routing: RoutingProvider;
  readonly geocode: GeocodeProvider;
  /**
   * The real-world toll plaza table (T5 Wave 2, `j-20260916-9y`). Required,
   * not optional: `/routes/plan` is F1's always-on surface, and an empty
   * store (before Wave 3's ingestion job has ever run) is a normal state
   * `listActive()` already answers with `[]` — there is no "half-wired"
   * configuration to guard against the way G1's optional triple has.
   */
  readonly tollPlazas: TollPlazaStore;
}

/**
 * Validate and narrow a persisted `tariff` JSON value back into
 * `@qualroteiro/tolls`'s `TariffByAxleCategory` shape.
 *
 * `record.tariff` is `unknown` at this boundary (see
 * `store/toll-plaza-store.ts`'s doc-comment) — a `Json` column proves nothing
 * about its own shape. This requires every {@link AXLE_CATEGORIES} key to be
 * present and a finite number before trusting it; anything else (`null`, a
 * missing key, a non-numeric value, a JSON array/primitive) returns
 * `undefined` rather than throwing. Same "skip, don't crash" philosophy
 * `@qualroteiro/tolls`'s `parseOsmCharge` uses for a `charge` tag it can't
 * parse: a plaza with no tariff is a normal, already-handled state
 * (`matchTolls` lists it and excludes it from `total`); a malformed row
 * making `/routes/plan` 500 is not.
 */
function toTariff(tariff: unknown): TariffByAxleCategory | undefined {
  if (tariff === null || typeof tariff !== 'object' || Array.isArray(tariff)) {
    return undefined;
  }

  const raw = tariff as Record<string, unknown>;
  const entries = AXLE_CATEGORIES.map((category) => [category, raw[category]] as const);

  const allNumeric = entries.every(([, value]) => typeof value === 'number' && Number.isFinite(value));
  if (!allNumeric) return undefined;

  return Object.fromEntries(entries) as TariffByAxleCategory;
}

/**
 * Map one persisted, real-world plaza to the shape `matchTolls` matches
 * against a route.
 *
 * `tariffByAxleCategory` comes from `record.tariff` when it validates as a
 * real {@link TariffByAxleCategory} (`toTariff`), `undefined` otherwise —
 * every ANTT row today (Fase 1 never had a tariff column, and the migration
 * that added one backfilled every existing row's `tariff` as `null`) and any
 * OSM row whose `charge` tag didn't parse. `matchTolls` still matches and
 * lists a plaza with no tariff; it simply contributes nothing to `total`
 * (`@qualroteiro/tolls`'s own doc-comment on `matchTolls`).
 */
function toTollPlaza(record: TollPlazaRecord): TollPlaza {
  return {
    id: record.id,
    name: record.name,
    concessionaire: record.concessionaire,
    highway: record.highway,
    km: record.km,
    lat: record.lat,
    lng: record.lng,
    tariffByAxleCategory: toTariff(record.tariff),
  };
}

/** Turn a validated place input into coordinates, geocoding text if needed. */
async function resolvePlace(
  input: PlaceInput,
  field: string,
  geocode: GeocodeProvider,
): Promise<LngLat> {
  if (input.kind === 'coords') return input.value;

  let hits;
  try {
    hits = await geocode.search(input.value);
  } catch (cause) {
    throw new ProviderError('geocode', `geocoding failed for ${field}`, { cause });
  }

  const top = hits[0];
  if (top === undefined) {
    throw new UnresolvedPlaceError(field, input.value);
  }

  return { lng: top.lng, lat: top.lat };
}

/** Decorate one provider alternative with its toll and fuel costs. */
function planOne(
  alt: RouteAlternative,
  req: PlanRequestInput,
  tollPlazaCandidates: readonly TollPlaza[],
): PlannedRoute {
  const tolls = matchTolls({
    routeGeometry: alt.geometry,
    axleCategory: req.vehicle.axleCategory,
    plazas: tollPlazaCandidates,
  });

  const fuelStations = matchFuelStations({ routeGeometry: alt.geometry });

  const fuel = estimateFuel({
    distanceKm: alt.distanceKm,
    consumptionKmPerL: req.vehicle.consumptionKmPerL,
    pricePerL: req.fuelPricePerL,
  });

  return {
    geometry: alt.geometry,
    distanceKm: alt.distanceKm,
    durationMin: alt.durationMin,
    tolls: { plazas: tolls.plazas, total: tolls.total },
    fuel: { liters: fuel.liters, cost: fuel.cost },
    points: { tolls: tolls.plazas, fuelStations: fuelStations.stations },
  };
}

export function registerPlanRoute(app: FastifyInstance, deps: PlanRouteDeps): void {
  app.post('/routes/plan', async (request) => {
    // Throws ValidationError (→400); the app-level error handler maps it.
    const planRequest = parsePlanRequest(request.body);

    const origin = await resolvePlace(planRequest.origin, 'origin', deps.geocode);
    const destination = await resolvePlace(planRequest.destination, 'destination', deps.geocode);

    const waypoints: LngLat[] = [];
    for (const [i, wp] of planRequest.waypoints.entries()) {
      waypoints.push(await resolvePlace(wp, `waypoints[${i}]`, deps.geocode));
    }

    let result;
    try {
      result = await deps.routing.route({
        origin,
        destination,
        ...(waypoints.length > 0 ? { waypoints } : {}),
        profile: planRequest.vehicle.type,
      });
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      throw new ProviderError('routing', 'routing provider failed', { cause });
    }

    // Fetched once per request, not once per alternative — every alternative
    // is matched against the same candidate list. An empty table (before
    // Wave 3's ingestion job has ever run) resolves to `[]` here, which is
    // exactly the "toll-free" state `matchTolls` already handles.
    const tollPlazaCandidates = (await deps.tollPlazas.listActive()).map(toTollPlaza);

    return {
      routes: result.routes.map((alt) => planOne(alt, planRequest, tollPlazaCandidates)),
    };
  });
}
