/**
 * BullMQ wiring for the monthly `ingest-toll-plazas` schedule.
 *
 * Redis connection comes from `REDIS_URL` (see `.env.example` — same value
 * `apps/api` uses, `infra/docker-compose.yml`'s `redis` service). Kept out
 * of `ingest.ts` on purpose: the core ingestion logic has no BullMQ/Redis
 * dependency, so it's testable (and runnable via `cli.ts`) without a Redis
 * instance at all.
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

import { getPrismaClient } from './prisma-client.js';
import { ingestTollPlazas, type IngestSummary } from './ingest.js';
import { log } from './logger.js';

export const QUEUE_NAME = 'ingest-toll-plazas';
export const JOB_NAME = 'ingest-toll-plazas';
/** Stable id for the repeatable job registration — re-registering with the
 * same id is a no-op rather than a duplicate schedule, so restarting the
 * worker process never doubles up the monthly run. */
export const REPEATABLE_JOB_ID = 'monthly-ingest-toll-plazas';
/** 06:00 UTC on the 1st of every month — ANTT republishes monthly, no need
 * to poll more often. */
export const MONTHLY_CRON_PATTERN = '0 6 1 * *';

export function createRedisConnection(redisUrl: string = requireRedisUrl()): IORedis {
  // `maxRetriesPerRequest: null` is BullMQ's documented requirement for a
  // blocking connection (https://docs.bullmq.io) — without it, ioredis's
  // own retry/backoff can silently swallow the blocking commands BullMQ
  // relies on.
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

function requireRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required to connect to Redis for BullMQ.');
  return url;
}

export function createIngestQueue(connection: IORedis): Queue {
  return new Queue(QUEUE_NAME, { connection });
}

/**
 * Registers (or re-confirms) the monthly repeatable job. Safe to call every
 * time the worker process starts — BullMQ dedupes on `jobId` plus the repeat
 * options, so this does not create a second schedule.
 */
export async function scheduleMonthlyIngest(queue: Queue): Promise<void> {
  await queue.add(
    JOB_NAME,
    {},
    { repeat: { pattern: MONTHLY_CRON_PATTERN }, jobId: REPEATABLE_JOB_ID },
  );
}

/**
 * Creates the worker that actually runs `ingestTollPlazas` when the
 * scheduled (or manually enqueued) job fires.
 */
export function createIngestWorker(connection: IORedis): Worker {
  return new Worker(
    QUEUE_NAME,
    async (_job: Job): Promise<IngestSummary> => {
      return ingestTollPlazas(getPrismaClient());
    },
    { connection },
  );
}

export function attachWorkerLogging(worker: Worker): void {
  worker.on('completed', (job) => {
    log.info('worker-job-completed', { jobId: job.id });
  });
  worker.on('failed', (job, err) => {
    log.error('worker-job-failed', { jobId: job?.id, error: err.message });
  });
}
