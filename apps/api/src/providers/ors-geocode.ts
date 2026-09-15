/**
 * `GeocodeProvider` implemented against OpenRouteService's Pelias geocoder.
 *
 * Same API key as the routing adapter. Satisfies WAVE 1's interface exactly.
 */

import type { GeocodeProvider, Place, PlaceKind } from '@qualroteiro/geo';

import { ProviderError } from '../errors.js';

export interface OrsGeocodeConfig {
  readonly apiKey: string;
  /** e.g. `https://api.openrouteservice.org`. */
  readonly baseUrl: string;
  /** Request timeout in ms. Default 10_000. */
  readonly timeoutMs?: number;
  /** Injectable for tests; defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Max hits to return. Default 5. */
  readonly size?: number;
  /**
   * ISO-3166 country filter. Defaults to `BRA` — qualroteiro is a Brazilian
   * road-trip planner, and unfiltered Pelias happily returns a "São Paulo" in
   * another hemisphere above the one the user meant.
   */
  readonly countryFilter?: string | null;
}

interface PeliasFeature {
  properties?: {
    id?: unknown;
    gid?: unknown;
    label?: unknown;
    name?: unknown;
    layer?: unknown;
  };
  geometry?: { coordinates?: unknown };
}

/** Convert one Pelias feature to a `Place`, or `null` if it is unusable. */
function toPlace(feature: PeliasFeature, index: number): Place | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
    return null;
  }

  const props = feature.properties ?? {};
  const label =
    typeof props.label === 'string'
      ? props.label
      : typeof props.name === 'string'
        ? props.name
        : null;

  if (label === null) return null;

  const id =
    typeof props.gid === 'string'
      ? props.gid
      : typeof props.id === 'string'
        ? props.id
        : `ors-${index}`;

  const place: Place = {
    id,
    label,
    lng: coords[0],
    lat: coords[1],
    ...(typeof props.layer === 'string' ? { kind: props.layer as PlaceKind } : {}),
  };

  return place;
}

/** Build a `GeocodeProvider` backed by OpenRouteService / Pelias. */
export function createOrsGeocodeProvider(config: OrsGeocodeConfig): GeocodeProvider {
  const {
    apiKey,
    baseUrl,
    timeoutMs = 10_000,
    fetchImpl = fetch,
    size = 5,
    countryFilter = 'BRA',
  } = config;

  return {
    async search(q: string): Promise<Place[]> {
      const url = new URL(`${baseUrl.replace(/\/+$/, '')}/geocode/search`);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('text', q);
      url.searchParams.set('size', String(size));
      if (countryFilter !== null) {
        url.searchParams.set('boundary.country', countryFilter);
      }

      let response: Response;
      try {
        response = await fetchImpl(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/geo+json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        throw new ProviderError('geocode', 'OpenRouteService geocoding failed or timed out', {
          cause,
        });
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(
          'geocode',
          `OpenRouteService geocoding responded ${response.status}${
            detail ? `: ${detail.slice(0, 300)}` : ''
          }`,
        );
      }

      let payload: { features?: unknown };
      try {
        payload = (await response.json()) as { features?: unknown };
      } catch (cause) {
        throw new ProviderError('geocode', 'OpenRouteService geocoding returned invalid JSON', {
          cause,
        });
      }

      const features = payload.features;
      if (!Array.isArray(features)) {
        throw new ProviderError('geocode', 'geocoding response had no features collection');
      }

      return features
        .map((f, i) => toPlace(f as PeliasFeature, i))
        .filter((p): p is Place => p !== null);
    },
  };
}
