/**
 * `@qualroteiro/routing` — the routing provider contract.
 *
 * Interface and types only. There is no provider implementation in this
 * package and there must never be one: implementations live in `apps/api`, so
 * this package's `dist/` stays free of any HTTP client.
 */

export type {
  RouteAlternative,
  RouteRequest,
  RouteResult,
  RoutingProvider,
} from './types.js';

// Re-exported for convenience so a consumer can type a provider adapter
// without also importing `@qualroteiro/geo` directly.
export type { LineString, LngLat, Position } from '@qualroteiro/geo';
