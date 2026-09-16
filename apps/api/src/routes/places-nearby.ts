/**
 * `GET /places/nearby` — Google Places Nearby Search behind our own cost
 * circuit breaker (G1).
 *
 * The breaker is checked and can refuse the request BEFORE `googlePlaces` is
 * ever called: reading the current month's counter costs one database read,
 * while an unblocked call to Google past the free tier costs real money. That
 * ordering — check, then call, then (only on success) increment — is the
 * entire point of this endpoint; see `specs/006-g1-google-places/plan.md`.
 */

import type { FastifyInstance } from 'fastify';

import { ProviderError, QuotaExceededError } from '../errors.js';
import { parseNearbyQuery } from '../http/validate.js';
import type { GooglePlacesProvider } from '../providers/google-places.js';
import { currentYearMonth, type ApiUsageStore } from '../store/api-usage.js';

/** The SKU this endpoint's counter is filed under. */
export const PLACES_NEARBY_SEARCH_SKU = 'places-nearby-search';

export interface PlacesNearbyRouteDeps {
  readonly googlePlaces: GooglePlacesProvider;
  readonly usage: ApiUsageStore;
  /** The circuit breaker's monthly ceiling for {@link PLACES_NEARBY_SEARCH_SKU}. */
  readonly monthlyCap: number;
  /** Injectable for tests; defaults to `() => new Date()`. */
  readonly now?: () => Date;
}

export function registerPlacesNearbyRoute(
  app: FastifyInstance,
  deps: PlacesNearbyRouteDeps,
): void {
  const now = deps.now ?? ((): Date => new Date());

  app.get('/places/nearby', async (request) => {
    // Throws ValidationError (→400) naming the offending field.
    const input = parseNearbyQuery(request.query);

    const yearMonth = currentYearMonth(now());
    const count = await deps.usage.getCount(PLACES_NEARBY_SEARCH_SKU, yearMonth);

    if (count >= deps.monthlyCap) {
      // Refused HERE, before deps.googlePlaces is touched — this is the
      // guard, not a log line after the fact.
      throw new QuotaExceededError(
        PLACES_NEARBY_SEARCH_SKU,
        `monthly cap of ${deps.monthlyCap} calls reached for '${PLACES_NEARBY_SEARCH_SKU}' ` +
          `(${yearMonth}); no request was sent to Google Places`,
      );
    }

    let places;
    try {
      places = await deps.googlePlaces.searchNearby(input);
    } catch (cause) {
      // The call left this process but did not complete — do not increment.
      throw new ProviderError('places', 'Google Places provider failed', { cause });
    }

    // Only a call that actually completed counts — see `ApiUsageCounter`'s
    // doc-comment in `prisma/schema.prisma`.
    await deps.usage.increment(PLACES_NEARBY_SEARCH_SKU, yearMonth);

    return { places };
  });
}
