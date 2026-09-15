/**
 * Shared geospatial types for qualroteiro.
 *
 * This module is types-only: it declares shapes and provider *interfaces*.
 * Concrete providers (which talk to a network) live in `apps/api`, never here.
 */

/** A WGS-84 position. */
export interface LngLat {
  readonly lng: number;
  readonly lat: number;
}

/**
 * A GeoJSON position: `[longitude, latitude]`.
 *
 * Longitude first — this is the GeoJSON axis order (RFC 7946 §3.1.1), and the
 * order MapLibre expects. It is deliberately the opposite of the `lat, lng`
 * order humans usually speak in, so it is expressed as a tuple type to make a
 * swapped pair a compile error rather than a bug on a map.
 */
export type Position = readonly [lng: number, lat: number];

/** A GeoJSON LineString geometry — the route geometry format qualroteiro standardises on. */
export interface LineString {
  readonly type: 'LineString';
  readonly coordinates: readonly Position[];
}

/** What kind of thing a geocoded {@link Place} is. Open-ended: providers differ. */
export type PlaceKind = 'address' | 'city' | 'poi' | 'region' | 'street' | (string & {});

/** A geocoding result. */
export interface Place {
  readonly id: string;
  readonly label: string;
  readonly lng: number;
  readonly lat: number;
  readonly kind?: PlaceKind;
}

/**
 * Forward geocoding, behind an interface.
 *
 * Implemented in `apps/api` against a managed provider. Intentionally has no
 * notion of an API key, a base URL or a transport — an adapter holds those in
 * its own closure or constructor.
 */
export interface GeocodeProvider {
  search(q: string): Promise<Place[]>;
}

/** The result of projecting a point onto a line. */
export interface NearestPointOnLine {
  /** The closest position on the line itself. */
  readonly point: LngLat;
  /** Great-circle distance from the query point to {@link point}, in metres. */
  readonly distanceMeters: number;
  /** Where {@link point} falls along the line, from 0 (start) to 1 (end). */
  readonly fractionAlong: number;
}
