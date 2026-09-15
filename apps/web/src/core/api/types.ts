/**
 * The `apps/api` HTTP contract, as this app consumes it.
 *
 * Versioned upstream in `apps/api/specs/002-rota-custos-api/spec.md` and verified
 * against the handler source (`apps/api/src/routes/plan.ts`). Domain shapes are
 * *imported* from the WAVE 1 packages rather than restated here, so a change to
 * `TollPlaza` or `Place` surfaces as a type error in this app instead of a silent
 * divergence between two hand-maintained copies.
 */

import type { LineString, LngLat, Place } from '@qualroteiro/geo';
import type { AxleCategory, TollPlaza } from '@qualroteiro/tolls';

export type { AxleCategory, LineString, LngLat, Place, TollPlaza };

/**
 * A place, the way the API accepts one.
 *
 * The contract takes either coordinates or free text for `origin`, `destination`
 * and each stop. This app sends coordinates when the user picked a geocoding hit
 * and the raw string when they typed something and submitted without picking —
 * which is precisely the path that can produce a `422`.
 */
export type PlaceInput = LngLat | string;

/** The vehicle profile the cost model needs. */
export interface VehicleProfile {
  /** Free-form label, forwarded to the routing provider as its profile. */
  readonly type: string;
  /** Which tariff column to read from a plaza's `tariffByAxleCategory`. */
  readonly axleCategory: AxleCategory;
  /** Kilometres per litre; must be > 0. */
  readonly consumptionKmPerL: number;
}

/** Request body of `POST /routes/plan`. */
export interface PlanRouteRequest {
  readonly origin: PlaceInput;
  readonly destination: PlaceInput;
  /** Intermediate stops in visit order. */
  readonly waypoints: readonly PlaceInput[];
  readonly vehicle: VehicleProfile;
  /** BRL per litre; must be >= 0. */
  readonly fuelPricePerL: number;
}

export interface TollsBreakdown {
  readonly plazas: readonly TollPlaza[];
  readonly total: number;
}

export interface FuelBreakdown {
  readonly liters: number;
  readonly cost: number;
}

/**
 * Points the route passes.
 *
 * `fuelStations` is always empty in F1 — the WAVE 1 seed carries no station data
 * and ingestion is out of scope. The field is part of the contract so the panel
 * can exist now and populating it later is not a contract change; the UI renders
 * an explicit empty state rather than hiding the section.
 */
export interface RoutePoints {
  readonly tolls: readonly TollPlaza[];
  readonly fuelStations: readonly FuelStation[];
}

/** Shape reserved for a later phase; never populated in F1. */
export interface FuelStation {
  readonly id: string;
  readonly name: string;
  readonly lng: number;
  readonly lat: number;
}

/** One route alternative and its costs — the unit the result screen renders. */
export interface PlannedRoute {
  readonly geometry: LineString;
  readonly distanceKm: number;
  readonly durationMin: number;
  readonly tolls: TollsBreakdown;
  readonly fuel: FuelBreakdown;
  readonly points: RoutePoints;
}

/** `200` body of `POST /routes/plan`. `routes` may legitimately be empty. */
export interface PlanRouteResponse {
  readonly routes: readonly PlannedRoute[];
}

/** `200` body of `GET /places/search`. `places` may be empty. */
export interface SearchPlacesResponse {
  readonly places: readonly Place[];
}

/** Uniform error body across `400`, `422` and `502`. */
export interface ApiErrorBody {
  readonly error: string;
}
