#!/usr/bin/env node
/**
 * Long-running process: `pnpm --filter @qualroteiro/data-ingest worker`.
 *
 * Connects to Redis (`REDIS_URL`), registers the monthly repeatable
 * `ingest-toll-plazas` job (idempotent — see `queue.ts`), and starts the
 * BullMQ `Worker` that processes it (and any manually-enqueued run) when it
 * fires. Runs until killed (SIGINT/SIGTERM), closing the queue/worker/Redis
 * connection and Prisma Client cleanly on the way out.
 */

import {
  attachWorkerLogging,
  createIngestQueue,
  createIngestWorker,
  createRedisConnection,
  scheduleMonthlyIngest,
} from './queue.js';
import { disconnectPrismaClient } from './prisma-client.js';
import { log } from './logger.js';

async function main(): Promise<void> {
  const connection = createRedisConnection();
  const queue = createIngestQueue(connection);
  await scheduleMonthlyIngest(queue);
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
