/**
 * `GooglePlacesProvider` implemented against Places API (New) — Nearby Search
 * only (G1). Follows the same pattern as `ors-routing.ts` / `ors-geocode.ts`:
 * config injectable, `fetchImpl` injectable for tests, errors typed as
 * `ProviderError`.
 *
 * V1 deliberately stops at Nearby Search: its response already carries name,
 * address and coordinates, which is everything `PlaceResult` needs. Place
 * Details (a second, separately-priced call per place) and Autocomplete are
 * out of scope — see `specs/006-g1-google-places/spec.md`.
 */

import { ProviderError } from '../errors.js';

/** The three modules G1 serves. Mirrors qualroteiro's module ids. */
export type PlaceCategory = 'hospedagem' | 'restaurantes' | 'atividades';

export const PLACE_CATEGORIES: readonly PlaceCategory[] = [
  'hospedagem',
  'restaurantes',
  'atividades',
];

export interface PlaceResult {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly category: PlaceCategory;
}

export interface NearbySearchRequest {
  readonly lat: number;
  readonly lng: number;
  readonly category: PlaceCategory;
  readonly radiusMeters: number;
}

export interface GooglePlacesProvider {
  searchNearby(req: NearbySearchRequest): Promise<PlaceResult[]>;
}

export interface GooglePlacesConfig {
  readonly apiKey: string;
  /** e.g. `https://places.googleapis.com`. */
  readonly baseUrl?: string;
  /** Request timeout in ms. Default 10_000. */
  readonly timeoutMs?: number;
  /** Injectable for tests; defaults to global `fetch` (built into Node 20). */
  readonly fetchImpl?: typeof fetch;
}

export const DEFAULT_GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com';

/**
 * Small, explicit field mask — Google's own recommended practice, and it
 * keeps every Nearby Search call billed at the same fixed rate regardless of
 * how many fields a future change might otherwise be tempted to request.
 */
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';

/**
 * Map a qualroteiro category to the Places API (New) `includedTypes` value.
 *
 * One type per category, not a list: a broader list would return results the
 * requesting module never asked for (e.g. a `restaurant` showing up in a
 * "Hospedagem" search).
 */
function toIncludedType(category: PlaceCategory): string {
  switch (category) {
    case 'hospedagem':
      return 'lodging';
    case 'restaurantes':
      return 'restaurant';
    case 'atividades':
      return 'tourist_attraction';
  }
}

interface GooglePlace {
  id?: unknown;
  displayName?: { text?: unknown };
  formattedAddress?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
}

/** Convert one Places API (New) place into a `PlaceResult`, or `null` if unusable. */
function toPlaceResult(place: GooglePlace, category: PlaceCategory): PlaceResult | null {
  const id = typeof place.id === 'string' ? place.id : null;
  const name = typeof place.displayName?.text === 'string' ? place.displayName.text : null;
  const address = typeof place.formattedAddress === 'string' ? place.formattedAddress : null;
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (
    id === null ||
    name === null ||
    address === null ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  ) {
    return null;
  }

  return { id, name, address, lat, lng, category };
}

/** Build a `GooglePlacesProvider` backed by Places API (New) Nearby Search. */
export function createGooglePlacesProvider(config: GooglePlacesConfig): GooglePlacesProvider {
  const {
    apiKey,
    baseUrl = DEFAULT_GOOGLE_PLACES_BASE_URL,
    timeoutMs = 10_000,
    fetchImpl = fetch,
  } = config;

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/places:searchNearby`;

  return {
    async searchNearby(req: NearbySearchRequest): Promise<PlaceResult[]> {
      const body = {
        includedTypes: [toIncludedType(req.category)],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: req.lat, longitude: req.lng },
            radius: req.radiusMeters,
          },
        },
      };

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        // Covers the AbortSignal timeout and any transport-level failure.
        throw new ProviderError('places', 'Google Places request failed or timed out', {
          cause,
        });
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ProviderError(
          'places',
          `Google Places responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
        );
      }

      let payload: { places?: unknown };
      try {
        payload = (await response.json()) as { places?: unknown };
      } catch (cause) {
        throw new ProviderError('places', 'Google Places returned invalid JSON', { cause });
      }

      const places = payload.places;
      if (!Array.isArray(places)) {
        // Nearby Search omits the `places` key entirely when nothing matches
        // — an empty result, not a malformed response.
        return [];
      }

      return places
        .map((p) => toPlaceResult(p as GooglePlace, req.category))
        .filter((p): p is PlaceResult => p !== null);
    },
  };
}
