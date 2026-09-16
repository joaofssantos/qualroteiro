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
  type FuelStationSeed,
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
 * Map one persisted, real-world plaza to the shape `matchTolls` matches
 * against a route.
 *
 * `tariffByAxleCategory` is always `undefined` here — the persisted
 * `TollPlazaRecord` carries no tariff column at all (see
 * `prisma/schema.prisma`'s doc-comment: per-concessionaire fare scraping is a
 * separate, future phase). `matchTolls` still matches and lists a plaza with
 * no tariff; it simply contributes nothing to `total` (`@qualroteiro/tolls`'s
 * own doc-comment on `matchTolls`).
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
    tariffByAxleCategory: undefined,
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
