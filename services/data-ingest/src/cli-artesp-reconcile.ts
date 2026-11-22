#!/usr/bin/env node
/** On-demand, repeatable ARTESP tariff precedence refresh. */

import { reconcileArtespTariffs } from './artesp-reconcile.js';
import { createLogger } from './logger.js';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.js';

const log = createLogger('reconcile-artesp-tariffs');

async function main(): Promise<void> {
  try {
    const summary = await reconcileArtespTariffs(getPrismaClient());
    log.info('cli-artesp-reconcile-finished', { ...summary });
  } catch (err) {
    log.error('cli-artesp-reconcile-failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

main();
