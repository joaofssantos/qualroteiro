/**
 * Request validation for the F1 endpoints.
 *
 * Hand-rolled rather than JSON-schema or zod (plan.md D-102): `origin` and
 * `destination` are a union of `string` and `{lng,lat}`, and the acceptance
 * criterion requires the 400 message to name the offending FIELD — which
 * AJV's `oneOf` reporting does not do well — while adding no runtime dependency.
 */

import type { LngLat } from '@qualroteiro/geo';
import { AXLE_CATEGORIES, type AxleCategory } from '@qualroteiro/tolls';

import { ValidationError } from '../errors.js';
import { PLACE_CATEGORIES, type PlaceCategory } from '../providers/google-places.js';

/** A place the client gave us: either coordinates already, or text to geocode. */
export type PlaceInput = { readonly kind: 'coords'; readonly value: LngLat } | {
  readonly kind: 'query';
  readonly value: string;
};

export interface VehicleInput {
  readonly type: string;
  readonly axleCategory: AxleCategory;
  readonly consumptionKmPerL: number;
}

export interface PlanRequestInput {
  readonly origin: PlaceInput;
  readonly destination: PlaceInput;
  readonly waypoints: readonly PlaceInput[];
  readonly vehicle: VehicleInput;
  readonly fuelPricePerL: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse one `origin`/`destination`/`waypoints[i]` value. */
function parsePlace(value: unknown, field: string): PlaceInput {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new ValidationError(field, `${field} must not be blank`);
    }
    return { kind: 'query', value: trimmed };
  }

  if (isRecord(value)) {
    const { lng, lat } = value;
    if (typeof lng !== 'number' || !Number.isFinite(lng)) {
      throw new ValidationError(field, `${field}.lng must be a finite number`);
    }
    if (typeof lat !== 'number' || !Number.isFinite(lat)) {
      throw new ValidationError(field, `${field}.lat must be a finite number`);
    }
    if (lng < -180 || lng > 180) {
      throw new ValidationError(field, `${field}.lng must be between -180 and 180, got ${lng}`);
    }
    if (lat < -90 || lat > 90) {
      throw new ValidationError(field, `${field}.lat must be between -90 and 90, got ${lat}`);
    }
    return { kind: 'coords', value: { lng, lat } };
  }

  throw new ValidationError(
    field,
    `${field} must be a place name string or an object with lng and lat`,
  );
}

function parseVehicle(value: unknown): VehicleInput {
  if (!isRecord(value)) {
    throw new ValidationError('vehicle', 'vehicle is required and must be an object');
  }

  const { type, axleCategory, consumptionKmPerL } = value;

  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new ValidationError('vehicle.type', 'vehicle.type must be a non-empty string');
  }

  if (typeof axleCategory !== 'string' || !isAxleCategory(axleCategory)) {
    throw new ValidationError(
      'vehicle.axleCategory',
      `vehicle.axleCategory must be one of: ${AXLE_CATEGORIES.join(', ')}`,
    );
  }

  if (typeof consumptionKmPerL !== 'number' || !Number.isFinite(consumptionKmPerL)) {
    throw new ValidationError(
      'vehicle.consumptionKmPerL',
      'vehicle.consumptionKmPerL must be a finite number',
    );
  }
  if (consumptionKmPerL <= 0) {
    throw new ValidationError(
      'vehicle.consumptionKmPerL',
      `vehicle.consumptionKmPerL must be greater than 0, got ${consumptionKmPerL}`,
    );
  }

  return { type, axleCategory, consumptionKmPerL };
}

function isAxleCategory(value: string): value is AxleCategory {
  return (AXLE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Validate a `POST /routes/plan` body.
 *
 * @throws {ValidationError} naming the first offending field.
 */
export function parsePlanRequest(body: unknown): PlanRequestInput {
  if (!isRecord(body)) {
    throw new ValidationError('body', 'body must be a JSON object');
  }

  const origin = parsePlace(body['origin'], 'origin');
  const destination = parsePlace(body['destination'], 'destination');

  const rawWaypoints = body['waypoints'];
  let waypoints: PlaceInput[] = [];
  if (rawWaypoints !== undefined && rawWaypoints !== null) {
    if (!Array.isArray(rawWaypoints)) {
      throw new ValidationError('waypoints', 'waypoints must be an array when present');
    }
    waypoints = rawWaypoints.map((item, i) => parsePlace(item, `waypoints[${i}]`));
  }

  const vehicle = parseVehicle(body['vehicle']);

  const fuelPricePerL = body['fuelPricePerL'];
  if (typeof fuelPricePerL !== 'number' || !Number.isFinite(fuelPricePerL)) {
    throw new ValidationError('fuelPricePerL', 'fuelPricePerL must be a finite number');
  }
  if (fuelPricePerL < 0) {
    throw new ValidationError(
      'fuelPricePerL',
      `fuelPricePerL must not be negative, got ${fuelPricePerL}`,
    );
  }

  return { origin, destination, waypoints, vehicle, fuelPricePerL };
}

/**
 * Validate the `q` query parameter of `GET /places/search`.
 *
 * @throws {ValidationError} if absent or blank.
 */
export function parseSearchQuery(query: unknown): string {
  const raw = isRecord(query) ? query['q'] : undefined;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new ValidationError('q', 'q is required and must be a non-empty search string');
  }

  return raw.trim();
}

export interface NearbyQueryInput {
  readonly lat: number;
  readonly lng: number;
  readonly category: PlaceCategory;
  readonly radiusMeters: number;
}

const DEFAULT_NEARBY_RADIUS_METERS = 3000;

/**
 * A query-string value, coerced from Fastify's raw string. Fastify hands
 * every query param back as a string (or `string[]` when repeated); a bare
 * `Number(undefined)` is `NaN` but `Number('')` is `0`, so blank is rejected
 * explicitly rather than trusted to fail the finiteness check below it.
 */
function parseNumberParam(raw: unknown, field: string): number {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new ValidationError(field, `${field} is required and must be a number`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new ValidationError(field, `${field} must be a finite number, got '${raw}'`);
  }
  return value;
}

function isPlaceCategory(value: string): value is PlaceCategory {
  return (PLACE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Validate the query of `GET /places/nearby`.
 *
 * @throws {ValidationError} naming `lat`, `lng`, `category` or `radiusMeters`.
 */
export function parseNearbyQuery(query: unknown): NearbyQueryInput {
  const q = isRecord(query) ? query : {};

  const lat = parseNumberParam(q['lat'], 'lat');
  if (lat < -90 || lat > 90) {
    throw new ValidationError('lat', `lat must be between -90 and 90, got ${lat}`);
  }

  const lng = parseNumberParam(q['lng'], 'lng');
  if (lng < -180 || lng > 180) {
    throw new ValidationError('lng', `lng must be between -180 and 180, got ${lng}`);
  }

  const rawCategory = q['category'];
  if (typeof rawCategory !== 'string' || !isPlaceCategory(rawCategory)) {
    throw new ValidationError(
      'category',
      `category must be one of: ${PLACE_CATEGORIES.join(', ')}`,
    );
  }

  let radiusMeters = DEFAULT_NEARBY_RADIUS_METERS;
  const rawRadius = q['radiusMeters'];
  if (rawRadius !== undefined) {
    radiusMeters = parseNumberParam(rawRadius, 'radiusMeters');
    if (radiusMeters <= 0) {
      throw new ValidationError(
        'radiusMeters',
        `radiusMeters must be a positive number, got ${radiusMeters}`,
      );
    }
  }

  return { lat, lng, category: rawCategory, radiusMeters };
}
