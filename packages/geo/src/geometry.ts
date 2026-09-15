/**
 * Pure geodesic helpers.
 *
 * Hand-rolled rather than pulled from `@turf/*`: qualroteiro needs exactly
 * three primitives (great-circle distance, point-to-segment projection,
 * interpolation along a line), and keeping the runtime dependency list empty
 * means `dist/` has no transitive surface to audit for network access.
 *
 * No I/O. No mutation of inputs. Every export is a pure function.
 */

import type { LineString, LngLat, NearestPointOnLine, Position } from './types.js';

/** IUGG mean Earth radius, in metres. */
const EARTH_RADIUS_METERS = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const asLngLat = (position: Position): LngLat => ({ lng: position[0], lat: position[1] });

function assertFinitePoint(point: LngLat, label: string): void {
  if (!Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    throw new RangeError(`${label} must have finite lng/lat, received (${point.lng}, ${point.lat})`);
  }
}

function coordinatesOf(line: LineString, caller: string): readonly Position[] {
  const coordinates = line.coordinates;
  if (coordinates.length === 0) {
    throw new RangeError(`${caller}: line has no coordinates`);
  }
  return coordinates;
}

/**
 * Great-circle distance between two positions, in metres.
 *
 * Uses the haversine formula, which stays numerically well-conditioned at the
 * short distances (tens of metres) this codebase cares about — unlike the
 * spherical law of cosines.
 */
export function haversineMeters(a: LngLat, b: LngLat): number {
  assertFinitePoint(a, 'haversineMeters: first point');
  assertFinitePoint(b, 'haversineMeters: second point');

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a line, in metres. A line of fewer than two points has length 0. */
export function lineLengthMeters(line: LineString): number {
  const coordinates = line.coordinates;
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const previous = coordinates[i - 1];
    const current = coordinates[i];
    if (previous === undefined || current === undefined) continue;
    total += haversineMeters(asLngLat(previous), asLngLat(current));
  }
  return total;
}

/**
 * Project a point onto a line, returning the closest position on the line, the
 * distance to it, and how far along the line it falls.
 *
 * Each segment is projected into a local equirectangular plane centred on that
 * segment's mean latitude. Over segment lengths of a few kilometres the
 * distortion is far below a metre, which is well inside the tolerance of the
 * ~500 m toll-matching buffer this exists to serve. The *reported* distance is
 * then re-measured with haversine, so the number handed back is a true
 * great-circle distance rather than a planar approximation.
 */
export function nearestPointOnLine(point: LngLat, line: LineString): NearestPointOnLine {
  assertFinitePoint(point, 'nearestPointOnLine: point');
  const coordinates = coordinatesOf(line, 'nearestPointOnLine');

  const first = coordinates[0];
  if (first === undefined) {
    throw new RangeError('nearestPointOnLine: line has no coordinates');
  }

  // Degenerate line: a single vertex is its own nearest point.
  if (coordinates.length === 1) {
    const only = asLngLat(first);
    return { point: only, distanceMeters: haversineMeters(point, only), fractionAlong: 0 };
  }

  const totalLength = lineLengthMeters(line);

  let best: NearestPointOnLine = {
    point: asLngLat(first),
    distanceMeters: Number.POSITIVE_INFINITY,
    fractionAlong: 0,
  };
  let travelled = 0;

  for (let i = 1; i < coordinates.length; i += 1) {
    const rawStart = coordinates[i - 1];
    const rawEnd = coordinates[i];
    if (rawStart === undefined || rawEnd === undefined) continue;

    const start = asLngLat(rawStart);
    const end = asLngLat(rawEnd);
    const segmentLength = haversineMeters(start, end);

    // Local equirectangular projection with `start` at the origin.
    const meanLat = toRadians((start.lat + end.lat) / 2);
    const metersPerLngDegree = (Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos(meanLat);
    const metersPerLatDegree = (Math.PI / 180) * EARTH_RADIUS_METERS;

    const endX = (end.lng - start.lng) * metersPerLngDegree;
    const endY = (end.lat - start.lat) * metersPerLatDegree;
    const pointX = (point.lng - start.lng) * metersPerLngDegree;
    const pointY = (point.lat - start.lat) * metersPerLatDegree;

    const segmentLengthSquared = endX * endX + endY * endY;
    // A zero-length segment (repeated vertex, or a segment collapsed at a pole)
    // projects everything onto its start point.
    const t =
      segmentLengthSquared === 0
        ? 0
        : clamp((pointX * endX + pointY * endY) / segmentLengthSquared, 0, 1);

    const candidate: LngLat = {
      lng: start.lng + ((endX * t) / metersPerLngDegree || 0),
      lat: start.lat + (endY * t) / metersPerLatDegree,
    };

    const distanceMeters = haversineMeters(point, candidate);
    if (distanceMeters < best.distanceMeters) {
      const alongLine = travelled + t * segmentLength;
      best = {
        point: candidate,
        distanceMeters,
        fractionAlong: totalLength === 0 ? 0 : clamp(alongLine / totalLength, 0, 1),
      };
    }

    travelled += segmentLength;
  }

  return best;
}

/**
 * Does `point` lie within `meters` of `line`?
 *
 * Inclusive at the boundary. This is the primitive `@qualroteiro/tolls` uses to
 * decide whether a route passes a toll plaza.
 */
export function isWithinBuffer(point: LngLat, line: LineString, meters: number): boolean {
  if (!Number.isFinite(meters) || meters <= 0) {
    throw new RangeError(`isWithinBuffer: buffer must be a positive number, received ${meters}`);
  }
  return nearestPointOnLine(point, line).distanceMeters <= meters;
}

/**
 * The position at `fraction` (0…1) of the way along a line.
 * Out-of-range fractions are clamped rather than rejected.
 */
export function pointAtFraction(line: LineString, fraction: number): LngLat {
  if (!Number.isFinite(fraction)) {
    throw new RangeError(`pointAtFraction: fraction must be finite, received ${fraction}`);
  }
  const coordinates = coordinatesOf(line, 'pointAtFraction');

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first === undefined || last === undefined) {
    throw new RangeError('pointAtFraction: line has no coordinates');
  }

  const totalLength = lineLengthMeters(line);
  if (totalLength === 0) return asLngLat(first);

  const target = clamp(fraction, 0, 1) * totalLength;
  let travelled = 0;

  for (let i = 1; i < coordinates.length; i += 1) {
    const rawStart = coordinates[i - 1];
    const rawEnd = coordinates[i];
    if (rawStart === undefined || rawEnd === undefined) continue;

    const start = asLngLat(rawStart);
    const end = asLngLat(rawEnd);
    const segmentLength = haversineMeters(start, end);

    if (travelled + segmentLength >= target) {
      const t = segmentLength === 0 ? 0 : (target - travelled) / segmentLength;
      return {
        lng: start.lng + (end.lng - start.lng) * t,
        lat: start.lat + (end.lat - start.lat) * t,
      };
    }
    travelled += segmentLength;
  }

  return asLngLat(last);
}

/**
 * The position `km` kilometres along a line, measured from its start.
 * Distances past the end of the line clamp to the final vertex.
 */
export function kmMarker(line: LineString, km: number): LngLat {
  if (!Number.isFinite(km)) {
    throw new RangeError(`kmMarker: distance must be finite, received ${km}`);
  }
  const totalLength = lineLengthMeters(line);
  if (totalLength === 0) return pointAtFraction(line, 0);
  return pointAtFraction(line, (km * 1000) / totalLength);
}
