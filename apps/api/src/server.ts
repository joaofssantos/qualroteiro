/**
 * Composition root.
 *
 * The ONLY module that constructs concrete providers and binds a port. Every
 * other module depends on WAVE 1's interfaces, which is what lets the whole
 * HTTP surface be tested without a network.
 */

import { buildApp } from './app.js';
import { readOrsEnv } from './env.js';
import { createOrsGeocodeProvider } from './providers/ors-geocode.js';
import { createOrsRoutingProvider } from './providers/ors-routing.js';

const ors = readOrsEnv();

const app = buildApp({
  routing: createOrsRoutingProvider({ apiKey: ors.apiKey, baseUrl: ors.baseUrl }),
  geocode: createOrsGeocodeProvider({ apiKey: ors.apiKey, baseUrl: ors.baseUrl }),
  fastifyOptions: { logger: true },
});

const port = Number(process.env['PORT'] ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
