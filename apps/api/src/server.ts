/**
 * Composition root.
 *
 * The ONLY module that constructs concrete providers, opens a database
 * connection, reads a secret, and binds a port. Every other module depends on
 * an interface, which is what lets the whole HTTP surface — F1's and F2a's —
 * be tested without a network and without Postgres.
 */

import { PrismaClient } from '@prisma/client';

import { buildApp } from './app.js';
import { createClerkAuthVerifier } from './auth/clerk.js';
import { loadDotEnvInto, readClerkEnv, readGooglePlacesEnv, readOrsEnv } from './env.js';
import { createGooglePlacesProvider } from './providers/google-places.js';
import { createOrsGeocodeProvider } from './providers/ors-geocode.js';
import { createOrsRoutingProvider } from './providers/ors-routing.js';
import { createPrismaApiUsageStore } from './store/prisma-api-usage.js';
import { createPrismaTripStore } from './store/prisma-trips.js';

// Picks up apps/api/.env in dev; a no-op when a real deployment injects
// ORS_API_KEY / CLERK_SECRET_KEY / GOOGLE_PLACES_API_KEY directly and no
// .env file exists.
loadDotEnvInto(process.env);

const ors = readOrsEnv();
const clerk = readClerkEnv();
const googlePlaces = readGooglePlacesEnv();

// Reads DATABASE_URL from the environment itself.
const prisma = new PrismaClient();

const app = buildApp({
  routing: createOrsRoutingProvider({ apiKey: ors.apiKey, baseUrl: ors.baseUrl }),
  geocode: createOrsGeocodeProvider({ apiKey: ors.apiKey, baseUrl: ors.baseUrl }),
  auth: createClerkAuthVerifier({ secretKey: clerk.secretKey }),
  trips: createPrismaTripStore(prisma),
  googlePlaces: createGooglePlacesProvider({ apiKey: googlePlaces.apiKey }),
  apiUsage: createPrismaApiUsageStore(prisma),
  placesMonthlyCap: googlePlaces.searchMonthlyCap,
  fastifyOptions: { logger: true },
});

// Close the pool on the way out so a restarting container does not leave
// connections behind for the next one to contend with.
app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

const port = Number(process.env['PORT'] ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
