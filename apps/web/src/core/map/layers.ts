/**
 * The map's layer vocabulary.
 *
 * A "layer" here is a named, toggleable set of markers — pedágios today, postos
 * and (later) balanças, restaurantes, pontos de descanso. `MapCanvas` knows only
 * this shape, never what a plaza is, which is what lets a future module publish
 * its own layer without the map changing.
 */

import type { LngLat } from '@qualroteiro/geo';

/** Visual treatment for a marker. Open-ended so a module can add its own. */
export type MarkerKind = 'toll' | 'fuel' | 'waypoint' | 'origin' | 'destination' | (string & {});

export interface MapMarkerSpec {
  /** Unique within its layer; used to diff markers across renders. */
  readonly id: string;
  readonly lng: number;
  readonly lat: number;
  /** The marker's accessible name — what a screen reader and a test both read. */
  readonly label: string;
  readonly kind?: MarkerKind;
}

/** A layer's static identity, declared by a module before any data exists. */
export interface MapLayerDescriptor {
  readonly id: string;
  readonly label: string;
  /** Whether the layer starts switched on. Defaults to `true`. */
  readonly defaultVisible?: boolean;
}

/** A layer plus the markers currently in it. */
export interface MapLayerData extends MapLayerDescriptor {
  readonly markers: readonly MapMarkerSpec[];
}

/** The route line the map draws, or `null` when there is nothing to draw. */
export interface RouteTrace {
  readonly coordinates: readonly (readonly [number, number])[];
}

/** Marker colours, keyed by kind. Kept next to the vocabulary they describe. */
export const MARKER_STYLES: Record<string, { bg: string; ring: string }> = {
  toll: { bg: 'hsl(0 72% 45%)', ring: 'hsl(0 72% 90%)' },
  fuel: { bg: 'hsl(158 64% 32%)', ring: 'hsl(158 64% 88%)' },
  origin: { bg: 'hsl(202 80% 20%)', ring: 'hsl(202 80% 88%)' },
  destination: { bg: 'hsl(38 92% 45%)', ring: 'hsl(38 92% 90%)' },
  waypoint: { bg: 'hsl(209 14% 43%)', ring: 'hsl(209 14% 88%)' },
};

export const DEFAULT_MARKER_STYLE = MARKER_STYLES['waypoint'] as { bg: string; ring: string };

/**
 * A bounding box for a set of positions, as MapLibre's `fitBounds` wants it.
 * Returns `null` for an empty set so a caller cannot fit to nothing.
 */
export function boundsOf(
  positions: readonly (readonly [number, number])[],
): [[number, number], [number, number]] | null {
  const first = positions[0];
  if (first === undefined) return null;

  let [minLng, minLat] = first;
  let [maxLng, maxLat] = first;
  for (const [lng, lat] of positions) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Build a marker spec from anything with coordinates. */
export function markerAt(
  position: LngLat,
  spec: { id: string; label: string; kind?: MarkerKind },
): MapMarkerSpec {
  return { ...spec, lng: position.lng, lat: position.lat };
}
