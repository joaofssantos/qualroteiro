import type { LngLat, PlaceInput, PlannedRoute } from '@/core/api/types';
import type { TripItem } from '@/core/api/trips';
import type { PlanQuery } from '@/core/store/routeStore';

/**
 * Geo extraction for trip items — the map-pin counterpart to
 * `describeTripItem.ts`'s human-readable summaries.
 *
 * Same discipline as that file: `payload` is `unknown` by contract and
 * `moduleId` is free-form, so every branch narrows defensively (presence +
 * `typeof` checks, no `as` casts) and returns `null` for anything that
 * doesn't narrow cleanly. Never throws. An item without a usable coordinate
 * — a manual address, or one saved before coordinates/queries existed —
 * simply gets no marker; that is the contract, not an error case.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Hospedagem/Restaurantes/Atividades all save `lat`/`lng` at the payload root. */
function extractFlatCoordinate(payload: unknown): LngLat | null {
  if (!isRecord(payload)) return null;
  if (!isFiniteNumber(payload.lat) || !isFiniteNumber(payload.lng)) return null;
  return { lat: payload.lat, lng: payload.lng };
}

function isPlaceInputPayload(value: unknown): value is PlaceInput {
  if (typeof value === 'string') return true;
  return isRecord(value) && isFiniteNumber(value.lat) && isFiniteNumber(value.lng);
}

function isPlanQueryPayload(value: unknown): value is PlanQuery {
  if (!isRecord(value)) return false;
  if (!isPlaceInputPayload(value.origin) || !isPlaceInputPayload(value.destination)) return false;
  if (!Array.isArray(value.waypoints) || !value.waypoints.every(isPlaceInputPayload)) return false;
  if (!isRecord(value.vehicle)) return false;
  if (typeof value.vehicle.type !== 'string') return false;
  if (typeof value.vehicle.axleCategory !== 'string') return false;
  if (!isFiniteNumber(value.vehicle.consumptionKmPerL)) return false;
  if (!isFiniteNumber(value.fuelPricePerL)) return false;
  if (typeof value.originLabel !== 'string' || typeof value.destinationLabel !== 'string') return false;
  return true;
}

/**
 * A saved route payload is `{...PlannedRoute, query}` (`SaveRouteToTripDialog`).
 * Checked field-by-field rather than trusting the shape, since `payload` may
 * equally be a Wave 1 route saved before `query` existed at all.
 */
function isPlannedRoutePayload(value: Record<string, unknown>): value is Record<string, unknown> & PlannedRoute {
  if (!isRecord(value.geometry) || !Array.isArray(value.geometry.coordinates)) return false;
  if (!isFiniteNumber(value.distanceKm) || !isFiniteNumber(value.durationMin)) return false;
  if (!isRecord(value.tolls) || !isFiniteNumber(value.tolls.total) || !Array.isArray(value.tolls.plazas)) return false;
  if (!isRecord(value.fuel) || !isFiniteNumber(value.fuel.cost) || !isFiniteNumber(value.fuel.liters)) return false;
  if (!isRecord(value.points) || !Array.isArray(value.points.tolls) || !Array.isArray(value.points.fuelStations)) {
    return false;
  }
  return true;
}

/**
 * Extracts `{ route, query }` from a `moduleId: 'rota-custos'` item, or
 * `null` when it isn't one, its payload doesn't narrow to a `PlannedRoute`,
 * or — the Wave 1/pre-Wave-2 case — it has no saved `query` at all. Reopening
 * a route on Tela 2 needs both: the route to show and the query that
 * produced it (`routeStore.restoreRoute`).
 */
export function extractSavedRoute(item: TripItem): { route: PlannedRoute; query: PlanQuery } | null {
  if (item.moduleId !== 'rota-custos') return null;
  const payload = item.payload;
  if (!isRecord(payload)) return null;
  // Split `query` off before validating the rest as a `PlannedRoute` — the
  // restored route should be exactly what `/routes/plan` would have
  // returned, not that plus a stray `query` key.
  const { query, ...rest } = payload;
  if (!isPlanQueryPayload(query)) return null;
  if (!isPlannedRoutePayload(rest)) return null;
  return { route: rest, query };
}

/**
 * A pin position for a trip item, or `null` when it has none.
 *
 * Hospedagem/Restaurantes/Atividades read `lat`/`lng` straight off the
 * payload. Rota-custos has no such flat field — its natural point is where
 * the saved query's route started — so it is only pinned when it carries a
 * geocoded (not free-text) `query.origin`, which is exactly the same
 * condition that makes it reopenable. An item without a coordinate is not an
 * error: it just does not appear on the map.
 */
export function extractTripItemCoordinate(item: TripItem): LngLat | null {
  switch (item.moduleId) {
    case 'hospedagem':
    case 'restaurantes':
    case 'atividades':
      return extractFlatCoordinate(item.payload);
    case 'rota-custos': {
      const saved = extractSavedRoute(item);
      if (!saved) return null;
      const origin = saved.query.origin;
      if (typeof origin === 'string') return null;
      return { lat: origin.lat, lng: origin.lng };
    }
    default:
      return null;
  }
}
