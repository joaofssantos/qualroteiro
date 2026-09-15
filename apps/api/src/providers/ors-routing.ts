/**
 * `RoutingProvider` implemented against OpenRouteService.
 *
 * This is one of the two places in qualroteiro that knows a vendor exists. It
 * satisfies WAVE 1's interface exactly, so swapping in self-hosted Valhalla
 * later means adding a sibling file, not editing a handler.
 */

import type { LineString, Position } from '@qualroteiro/geo';
import type { RouteAlternative, RouteRequest, RouteResult, RoutingProvider } from '@qualroteiro/routing';

import { ProviderError } from '../errors.js';

export interface OrsRoutingConfig {
  readonly apiKey: string;
  /** e.g. `https://api.openrouteservice.org`. */
  readonly baseUrl: string;
  /** Request timeout in ms. Default 15_000. */
  readonly timeoutMs?: number;
  /** Injectable for tests; defaults to global `fetch` (built into Node 20). */
  readonly fetchImpl?: typeof fetch;
  /** How many alternatives to ask for. Default 2. */
  readonly alternativeCount?: number;
}

/**
 * Map a qualroteiro vehicle profile to an ORS costing profile.
 *
 * Unknown values fall back to `driving-car` rather than erroring: the profile
 * is a UI label, and refusing to route because someone typed `sedan` would be
 * worse than routing them as a car.
 */
function toOrsProfile(profile: string | undefined): string {
  switch ((profile ?? 'car').toLowerCase()) {
    case 'truck':
    case 'hgv':
    case 'caminhao':
    case 'caminhão':
      return 'driving-hgv';
    default:
      return 'driving-car';
  }
}

interface OrsFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { summary?: { distance?: unknown; duration?: unknown } };
}

function isPositionArray(value: unknown): value is Position[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number',
    )
  );
}

/** Convert one ORS GeoJSON feature into a `RouteAlternative`. */
function toAlternative(feature: OrsFeature, index: number): RouteAlternative {
  const coordinates = feature.geometry?.coordinates;
  if (feature.geometry?.type !== 'LineString' || !isPositionArray(coordinates)) {
    throw new ProviderError(
      'routing',
      `OpenRouteService returned a feature without LineString geometry (index ${index})`,
    );
  }

  const summary = feature.properties?.summary;
  const distanceMeters = summary?.distance;
  const durationSeconds = summary?.duration;

  if (typeof distanceMeters !== 'number' || typeof durationSeconds !== 'number') {
    throw new ProviderError(
      'routing',
      `OpenRouteService returned a feature without a distance/duration summary (index ${index})`,
    );
  }

  const geometry: LineString = {
    type: 'LineString',
    coordinates: coordinates.map(([lng, lat]) => [lng, lat] as Position),
  };

  return {
    geometry,
    distanceKm: distanceMeters / 1000,
    durationMin: durationSeconds / 60,
  };
}

/** Build a `RoutingProvider` backed by OpenRouteService directions. */
export function createOrsRoutingProvider(config: OrsRoutingConfig): RoutingProvider {
  const {
    apiKey,
    baseUrl,
    timeoutMs = 15_000,
    fetchImpl = fetch,
    alternativeCount = 2,
  } = config;

  const endpointFor = (profile: string): string =>
    `${baseUrl.replace(/\/+$/, '')}/v2/directions/${profile}/geojson`;

  async function call(url: string, body: unknown): Promise<Response> {
    try {
      return await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/geo+json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      // Covers the AbortSignal timeout and any transport-level failure.
      throw new ProviderError('routing', 'OpenRouteService request failed or timed out', {
        cause,
      });
    }
  }

  return {
    async route(req: RouteRequest): Promise<RouteResult> {
      const coordinates: Position[] = [
        [req.origin.lng, req.origin.lat],
        ...(req.waypoints ?? []).map((w) => [w.lng, w.lat] as Position),
        [req.destination.lng, req.destination.lat],
      ];

      const url = endpointFor(toOrsProfile(req.profile));

      // ORS only accepts alternative_routes for exactly two coordinates.
      const wantsAlternatives = coordinates.length === 2 && alternativeCount > 1;
      const baseBody = { coordinates };
      const bodyWithAlternatives = {
        ...baseBody,
        alternative_routes: {
          target_count: alternativeCount,
          share_factor: 0.6,
          weight_factor: 1.4,
        },
      };

      let response = await call(url, wantsAlternatives ? bodyWithAlternatives : baseBody);

      // D-107: some plans/geometries reject alternatives. Retry once without.
      if (!response.ok && wantsAlternatives && response.status >= 400 && response.status < 500) {
        response = await call(url, baseBody);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(
          'routing',
          `OpenRouteService responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
        );
      }

      let payload: { features?: unknown };
      try {
        payload = (await response.json()) as { features?: unknown };
      } catch (cause) {
        throw new ProviderError('routing', 'OpenRouteService returned invalid JSON', { cause });
      }

      const features = payload.features;
      if (!Array.isArray(features)) {
        throw new ProviderError(
          'routing',
          'OpenRouteService response had no features collection',
        );
      }

      return { routes: features.map((f, i) => toAlternative(f as OrsFeature, i)) };
    },
  };
}
