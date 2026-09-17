#!/usr/bin/env node
/**
 * Long-running process: `pnpm --filter @qualroteiro/data-ingest worker`.
 *
 * Connects to Redis (`REDIS_URL`), registers both monthly repeatable jobs —
 * `ingest-toll-plazas` (ANTT) and `ingest-toll-plazas-osm` (OSM,
 * `j-20260916-y9` Wave 3) — idempotent, see `queue.ts`, and starts the one
 * BullMQ `Worker` that processes whichever fires (dispatched by job name) or
 * is manually enqueued. Runs until killed (SIGINT/SIGTERM), closing the
 * queue/worker/Redis connection and Prisma Client cleanly on the way out.
 */

import {
  attachWorkerLogging,
  createIngestQueue,
  createIngestWorker,
  createRedisConnection,
  scheduleMonthlyIngest,
  scheduleMonthlyOsmIngest,
} from './queue.js';
import { disconnectPrismaClient } from './prisma-client.js';
import { log } from './logger.js';

async function main(): Promise<void> {
  const connection = createRedisConnection();
  const queue = createIngestQueue(connection);
  await scheduleMonthlyIngest(queue);
  await scheduleMonthlyOsmIngest(queue);
  log.info('worker-schedule-registered');

  const worker = createIngestWorker(connection);
  attachWorkerLogging(worker);
  log.info('worker-started');

  const shutdown = async (signal: string): Promise<void> => {
    log.info('worker-shutting-down', { signal });
    await worker.close();
    await queue.close();
    await disconnectPrismaClient();
    connection.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('worker-startup-failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
