/**
 * `GET /places/search` — forward geocoding behind the injected provider.
 */

import type { FastifyInstance } from 'fastify';
import type { GeocodeProvider, Place } from '@qualroteiro/geo';

import { ProviderError } from '../errors.js';
import { parseSearchQuery } from '../http/validate.js';

export interface PlacesRouteDeps {
  readonly geocode: GeocodeProvider;
}

export function registerPlacesRoute(app: FastifyInstance, deps: PlacesRouteDeps): void {
  app.get('/places/search', async (request) => {
    // Throws ValidationError (→400) when q is absent or blank.
    const q = parseSearchQuery(request.query);

    let places: Place[];
    try {
      places = await deps.geocode.search(q);
    } catch (cause) {
      throw new ProviderError('geocode', 'geocoding provider failed', { cause });
    }

    return { places };
  });
}
