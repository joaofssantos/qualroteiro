#!/usr/bin/env node
/**
 * On-demand run: `pnpm --filter @qualroteiro/data-ingest ingest:once`.
 *
 * Runs `ingestTollPlazas` once, directly against the real downloaded CSV and
 * the real Prisma Client (`DATABASE_URL`) — no Redis, no BullMQ, no
 * scheduling. This is the initial-seed / manual-testing path the spec asks
 * for, separate from `worker.ts`'s scheduled path.
 */

import { ingestTollPlazas } from './ingest.js';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.js';
import { log } from './logger.js';

async function main(): Promise<void> {
  log.info('cli-run-started');
  try {
    const summary = await ingestTollPlazas(getPrismaClient());
    log.info('cli-run-finished', { ...summary });
  } catch (err) {
    log.error('cli-run-failed', { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

main();
