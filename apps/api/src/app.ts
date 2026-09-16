/**
 * `buildApp` — the application factory, and THE INJECTION SEAM.
 *
 * Handlers receive their providers through {@link AppDeps}; they never import a
 * concrete adapter. A test calls `buildApp({ routing: fake, geocode: fake })`
 * and exercises the production handlers with no network and no database, which
 * is what proves WAVE 1's interfaces are actually implementable and sufficient.
 *
 * `server.ts` is the only place that constructs the real OpenRouteService
 * adapters.
 */

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import type { GeocodeProvider } from '@qualroteiro/geo';
import type { RoutingProvider } from '@qualroteiro/routing';

import type { AuthVerifier } from './auth/verifier.js';
import {
  NotFoundError,
  ProviderError,
  QuotaExceededError,
  UnauthorizedError,
  UnresolvedPlaceError,
  ValidationError,
} from './errors.js';
import type { GooglePlacesProvider } from './providers/google-places.js';
import { registerAdminPlacesUsageRoute } from './routes/admin-places-usage.js';
import { registerAdminTollPlazasStatusRoute } from './routes/admin-toll-plazas-status.js';
import { registerHealthRoute } from './routes/health.js';
import { PLACES_NEARBY_SEARCH_SKU, registerPlacesNearbyRoute } from './routes/places-nearby.js';
import { registerPlacesRoute } from './routes/places.js';
import { registerPlanRoute } from './routes/plan.js';
import { registerTripRoutes } from './routes/trips.js';
import type { ApiUsageStore } from './store/api-usage.js';
import type { TollPlazaStore } from './store/toll-plaza-store.js';
import type { TripStore } from './store/trips.js';

/** Read a `statusCode` off an unknown thrown value, defaulting to 500. */
function statusCodeOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return 500;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'request could not be processed';
}

/** Everything the handlers need from the outside world. */
export interface AppDeps {
  readonly routing: RoutingProvider;
  readonly geocode: GeocodeProvider;
  /**
   * T5 Wave 2 (`j-20260916-9y`) — the real-world toll plaza table. Required,
   * like `routing`/`geocode`: `/routes/plan` is F1's always-on surface, and
   * `GET /admin/toll-plazas-status` reads the same store, so there is no
   * "some endpoints registered, some not" configuration to guard against the
   * way the optional pairs/triples below do.
   */
  readonly tollPlazas: TollPlazaStore;
  /**
   * The F2a ports. Both or neither (see {@link buildApp}) — an app given
   * neither serves F1 alone and exposes no `/trips*` surface, which is a real
   * configuration: "F1 funciona sozinho, sem login" (`F2-COORDINATION.md` §1),
   * and every F1 test builds exactly that app.
   */
  readonly auth?: AuthVerifier;
  readonly trips?: TripStore;
  /**
   * The G1 ports: all three or none, same "half-wiring is a configuration
   * bug" reasoning as `auth`/`trips` below. When present, both
   * `GET /places/nearby` and `GET /admin/places-usage` are registered.
   */
  readonly googlePlaces?: GooglePlacesProvider;
  readonly apiUsage?: ApiUsageStore;
  readonly placesMonthlyCap?: number;
  /** Passed straight to Fastify — tests silence the logger with `{ logger: false }`. */
  readonly fastifyOptions?: FastifyServerOptions;
}

/**
 * Build a fully wired Fastify instance.
 *
 * Synchronous by design: `@fastify/cors` and the routes are registered as
 * plugins and Fastify resolves them on the first `inject`/`listen`, so a test
 * needs no `await app.ready()` boilerplate.
 */
export function buildApp(deps: AppDeps): FastifyInstance {
  // Both F2a ports or neither. Half-wiring would produce an app whose
  // `/trips*` routes exist but cannot authenticate (or vice versa), and the
  // failure would surface as a confusing 500 on a user's first save rather
  // than here, at the composition root, where it is a one-line fix.
  if ((deps.auth === undefined) !== (deps.trips === undefined)) {
    throw new Error(
      'buildApp: `auth` and `trips` must be provided together — an app with one ' +
        'but not the other cannot serve /trips*',
    );
  }

  // All three G1 ports or none — half-wiring would leave `/places/nearby`
  // registered with no cap (an unbounded breaker) or no provider (a crash on
  // first request), rather than failing here at the composition root.
  const g1Wired = [deps.googlePlaces, deps.apiUsage, deps.placesMonthlyCap];
  if (g1Wired.some((v) => v !== undefined) && g1Wired.some((v) => v === undefined)) {
    throw new Error(
      'buildApp: `googlePlaces`, `apiUsage` and `placesMonthlyCap` must be provided ' +
        'together — an app with only some of them cannot serve /places/nearby',
    );
  }

  const app = Fastify(deps.fastifyOptions ?? { logger: false });

  // The web app is cross-origin; F1 is anonymous, so no credentials are needed.
  void app.register(cors);

  // Declared for every request so the property has a stable shape; only the
  // authenticated `/trips*` scope ever assigns to it.
  app.decorateRequest('authUserId', null);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: error.message });
    }
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({ error: error.message });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: error.message });
    }
    if (error instanceof UnresolvedPlaceError) {
      return reply.status(422).send({ error: error.message });
    }
    if (error instanceof ProviderError) {
      request.log.error({ err: error, provider: error.provider }, 'upstream provider failed');
      return reply.status(502).send({ error: error.message });
    }
    if (error instanceof QuotaExceededError) {
      request.log.warn({ sku: error.sku }, 'circuit breaker refused a call before making it');
      return reply.status(503).send({ error: error.message });
    }

    // Fastify's own body-parse failures (malformed JSON) are client errors.
    const statusCode = statusCodeOf(error);
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ error: messageOf(error) });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: 'internal server error' });
  });

  registerHealthRoute(app);
  registerPlacesRoute(app, { geocode: deps.geocode });
  registerPlanRoute(app, {
    routing: deps.routing,
    geocode: deps.geocode,
    tollPlazas: deps.tollPlazas,
  });
  registerAdminTollPlazasStatusRoute(app, { tollPlazas: deps.tollPlazas });

  if (deps.auth !== undefined && deps.trips !== undefined) {
    registerTripRoutes(app, { auth: deps.auth, trips: deps.trips });
  }

  if (
    deps.googlePlaces !== undefined &&
    deps.apiUsage !== undefined &&
    deps.placesMonthlyCap !== undefined
  ) {
    registerPlacesNearbyRoute(app, {
      googlePlaces: deps.googlePlaces,
      usage: deps.apiUsage,
      monthlyCap: deps.placesMonthlyCap,
    });
    registerAdminPlacesUsageRoute(app, {
      usage: deps.apiUsage,
      caps: { [PLACES_NEARBY_SEARCH_SKU]: deps.placesMonthlyCap },
    });
  }

  return app;
}
