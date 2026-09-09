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
import { type TollPlaza, matchTolls } from '@qualroteiro/tolls';
import { estimateFuel } from '@qualroteiro/fuel';

import { ProviderError, UnresolvedPlaceError } from '../errors.js';
import { type PlaceInput, type PlanRequestInput, parsePlanRequest } from '../http/validate.js';

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
     * Always empty in F1: the WAVE 1 toll seed carries corridors and plazas
     * only, and station ingestion is explicitly out of scope. The field ships
     * so `apps/web` can build the panel and populating it later is not a
     * contract change. See spec.md "Deliberate limitations".
     */
    readonly fuelStations: readonly never[];
  };
}

export interface PlanRouteDeps {
  readonly routing: RoutingProvider;
  readonly geocode: GeocodeProvider;
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
function planOne(alt: RouteAlternative, req: PlanRequestInput): PlannedRoute {
  const tolls = matchTolls({
    routeGeometry: alt.geometry,
    axleCategory: req.vehicle.axleCategory,
  });

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
    points: { tolls: tolls.plazas, fuelStations: [] },
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

    return { routes: result.routes.map((alt) => planOne(alt, planRequest)) };
  });
}
