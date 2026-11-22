#!/usr/bin/env node
/**
 * On-demand run: `pnpm --filter @qualroteiro/data-ingest ingest:osm:once`.
 *
 * Runs OSM ingestion then ARTESP tariff reconciliation once, directly against
 * the real Overpass API and Prisma Client (`DATABASE_URL`) — no Redis or
 * BullMQ. This preserves the regulator's audited fares after each OSM upsert.
 */

import { ingestOsmAndReconcileArtesp } from './osm-artesp-reconcile.js';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.js';
import { createLogger } from './logger.js';

const log = createLogger('ingest-toll-plazas-osm');

async function main(): Promise<void> {
  log.info('cli-osm-run-started');
  try {
    const summary = await ingestOsmAndReconcileArtesp(getPrismaClient());
    log.info('cli-osm-run-finished', { ...summary });
  } catch (err) {
    log.error('cli-osm-run-failed', { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

main();
