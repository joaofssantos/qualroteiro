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

import { ProviderError, UnresolvedPlaceError, ValidationError } from './errors.js';
import { registerHealthRoute } from './routes/health.js';
import { registerPlacesRoute } from './routes/places.js';
import { registerPlanRoute } from './routes/plan.js';

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
  const app = Fastify(deps.fastifyOptions ?? { logger: false });

  // The web app is cross-origin; F1 is anonymous, so no credentials are needed.
  void app.register(cors);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: error.message });
    }
    if (error instanceof UnresolvedPlaceError) {
      return reply.status(422).send({ error: error.message });
    }
    if (error instanceof ProviderError) {
      request.log.error({ err: error, provider: error.provider }, 'upstream provider failed');
      return reply.status(502).send({ error: error.message });
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
  registerPlanRoute(app, { routing: deps.routing, geocode: deps.geocode });

  return app;
}
