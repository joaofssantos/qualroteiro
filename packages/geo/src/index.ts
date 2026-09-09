/**
 * `@qualroteiro/geo` — geospatial types and pure geodesic helpers.
 *
 * Contains no network I/O, no HTTP client and no persistence. `GeocodeProvider`
 * is declared here as an interface; its implementations live in `apps/api`.
 */

export type {
  GeocodeProvider,
  LineString,
  LngLat,
  NearestPointOnLine,
  Place,
  PlaceKind,
  Position,
} from './types.js';

export {
  haversineMeters,
  isWithinBuffer,
  kmMarker,
  lineLengthMeters,
  nearestPointOnLine,
  pointAtFraction,
} from './geometry.js';
