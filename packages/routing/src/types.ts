/**
 * Routing provider contract.
 *
 * This module declares an interface and its request/response shapes. It holds
 * NO implementation: the concrete adapters (a managed routing vendor now, a
 * self-hosted Valhalla later) are built in `apps/api`, so this package never
 * acquires an HTTP client.
 */

import type { LineString, LngLat } from '@qualroteiro/geo';

/** A request for one or more route alternatives. */
export interface RouteRequest {
  readonly origin: LngLat;
  readonly destination: LngLat;
  /** Intermediate stops, in the order they must be visited. */
  readonly waypoints?: readonly LngLat[];
  /**
   * The vehicle/costing profile, e.g. `'auto'`, `'truck'`, `'motorcycle'`.
   *
   * Deliberately an open `string` rather than a union: every vendor names its
   * profiles differently, and an adapter must be able to pass its own through
   * without this package needing an edit. Validating the set is the adapter's
   * job.
   */
  readonly profile?: string;
}

/** One route option returned by a provider. */
export interface RouteAlternative {
  /**
   * The route's shape, as a GeoJSON LineString with `[lng, lat]` positions.
   *
   * GeoJSON — not an encoded polyline — is the qualroteiro interchange format:
   * it needs no decoder in `@qualroteiro/geo` or `@qualroteiro/tolls`, and
   * `apps/web` can hand it straight to MapLibre. A provider that speaks encoded
   * polyline decodes it inside its own adapter.
   */
  readonly geometry: LineString;
  /** Total driving distance, in kilometres. */
  readonly distanceKm: number;
  /** Estimated driving time, in minutes. */
  readonly durationMin: number;
}

/**
 * A provider's response.
 *
 * Always a list, even for a vendor that returns a single route — a one-element
 * array keeps the shape stable whether or not alternatives are supported.
 */
export interface RouteResult {
  readonly routes: readonly RouteAlternative[];
}

/**
 * Route calculation, behind an interface.
 *
 * Single-method and `Promise`-returning, with no mention of a vendor, an API
 * key, a base URL or a transport — those belong to the adapter's own closure or
 * constructor. Swapping providers must never require a change to this file.
 */
export interface RoutingProvider {
  route(req: RouteRequest): Promise<RouteResult>;
}
