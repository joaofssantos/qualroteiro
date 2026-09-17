#!/usr/bin/env node
/**
 * On-demand run: `pnpm --filter @qualroteiro/data-ingest ingest:osm:once`.
 *
 * Runs `ingestOsmTollPlazas` once, directly against the real Overpass API and
 * the real Prisma Client (`DATABASE_URL`) — no Redis, no BullMQ, no
 * scheduling. Same pattern as `cli.ts` (the ANTT on-demand entrypoint), kept
 * as its own file/script rather than a flag on `cli.ts` so neither existing
 * script changes shape.
 */

import { ingestOsmTollPlazas } from './osm-toll-plazas.js';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.js';
import { createLogger } from './logger.js';

const log = createLogger('ingest-toll-plazas-osm');

async function main(): Promise<void> {
  log.info('cli-osm-run-started');
  try {
    const summary = await ingestOsmTollPlazas(getPrismaClient());
    log.info('cli-osm-run-finished', { ...summary });
  } catch (err) {
    log.error('cli-osm-run-failed', { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

main();
