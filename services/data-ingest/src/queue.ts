/**
 * BullMQ wiring for the monthly `ingest-toll-plazas` (ANTT) and
 * `ingest-toll-plazas-osm` (OSM, `j-20260916-y9` Wave 3) schedules.
 *
 * Redis connection comes from `REDIS_URL` (see `.env.example` — same value
 * `apps/api` uses, `infra/docker-compose.yml`'s `redis` service). Kept out
 * of `ingest.ts`/`osm-toll-plazas.ts` on purpose: the core ingestion logic
 * has no BullMQ/Redis dependency, so it's testable (and runnable via
 * `cli.ts`/`cli-osm.ts`) without a Redis instance at all.
 *
 * **One queue, two job names** — the OSM job reuses `QUEUE_NAME` rather than
 * getting its own `Queue`/`Worker`/Redis connection pair: it's the same
 * infrastructure (one Redis, one worker process, one connection), and
 * BullMQ already dispatches by `Job.name` within a single `Worker`
 * processor, so a second queue would only duplicate connection-management
 * code for no isolation benefit this job actually needs (both jobs are
 * equally low-frequency, monthly, and neither blocks the other — the ANTT
 * and OSM repeatable schedules run on different days, see
 * `OSM_MONTHLY_CRON_PATTERN`, so they don't even contend for the same
 * worker slot in practice).
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

import { getPrismaClient } from './prisma-client.js';
import { ingestTollPlazas, type IngestSummary } from './ingest.js';
import { ingestOsmTollPlazas, type OsmIngestSummary } from './osm-toll-plazas.js';
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

/** The OSM ingestion job's name within the shared `QUEUE_NAME` queue. */
export const OSM_JOB_NAME = 'ingest-toll-plazas-osm';
/** Stable id for the OSM repeatable job registration — same
 * re-registration-is-a-no-op reasoning as `REPEATABLE_JOB_ID`. */
export const OSM_REPEATABLE_JOB_ID = 'monthly-ingest-toll-plazas-osm';
/** 06:00 UTC on the 2nd of every month — one day after the ANTT run
 * (`MONTHLY_CRON_PATTERN`), so the two monthly jobs don't land in the same
 * worker tick. OSM toll data changes no faster than ANTT's (orientation.md:
 * "dado de pedágio não muda todo dia"), so monthly is the same deliberate
 * cadence choice, just offset by a day. */
export const OSM_MONTHLY_CRON_PATTERN = '0 6 2 * *';

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
 * Registers (or re-confirms) the monthly ANTT repeatable job. Safe to call
 * every time the worker process starts — BullMQ dedupes on `jobId` plus the
 * repeat options, so this does not create a second schedule.
 */
export async function scheduleMonthlyIngest(queue: Queue): Promise<void> {
  await queue.add(
    JOB_NAME,
    {},
    { repeat: { pattern: MONTHLY_CRON_PATTERN }, jobId: REPEATABLE_JOB_ID },
  );
}

/**
 * Registers (or re-confirms) the monthly OSM repeatable job, same
 * idempotent-registration reasoning as {@link scheduleMonthlyIngest}.
 */
export async function scheduleMonthlyOsmIngest(queue: Queue): Promise<void> {
  await queue.add(
    OSM_JOB_NAME,
    {},
    { repeat: { pattern: OSM_MONTHLY_CRON_PATTERN }, jobId: OSM_REPEATABLE_JOB_ID },
  );
}

/**
 * Creates the worker that runs `ingestTollPlazas` (ANTT) or
 * `ingestOsmTollPlazas` (OSM) depending on which job fired — dispatched by
 * `Job.name`, the two job names registered above within the one shared
 * `QUEUE_NAME` queue (see this module's doc-comment for why one queue).
 */
export function createIngestWorker(connection: IORedis): Worker {
  return new Worker(
    QUEUE_NAME,
    async (job: Job): Promise<IngestSummary | OsmIngestSummary> => {
      if (job.name === OSM_JOB_NAME) {
        return ingestOsmTollPlazas(getPrismaClient());
      }
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
