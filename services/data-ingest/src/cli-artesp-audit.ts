#!/usr/bin/env node
/**
 * On-demand run: `pnpm --filter @qualroteiro/data-ingest audit:artesp:once`.
 *
 * Runs `runArtespAudit` once — downloads and parses the real ARTESP PDF,
 * reads every real `source: 'osm'` `TollPlazaRecord` (read-only), matches,
 * compares tariffs, and writes a Markdown report to disk. No BullMQ/Redis —
 * this is an on-demand audit, not a scheduled job (see `artesp-audit.ts`'s
 * doc-comment). Same shape as `cli.ts`/`cli-osm.ts`, kept as its own file so
 * neither existing entrypoint changes.
 *
 * Output path: `docs/audits/artesp-tariff-audit.md` (repo root, relative to
 * this package) by default — pass a different path as the first CLI
 * argument to override, e.g.
 * `pnpm audit:artesp:once -- /tmp/my-report.md`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runArtespAudit } from './artesp-audit.js';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.js';
import { createLogger } from './logger.js';

const log = createLogger('audit-artesp-tariffs');

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_PATH = resolve(PACKAGE_DIR, '../../../docs/audits/artesp-tariff-audit.md');

async function main(): Promise<void> {
  const outputPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUTPUT_PATH;

  log.info('cli-artesp-audit-run-started', { outputPath });
  try {
    const result = await runArtespAudit(getPrismaClient());
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.reportMarkdown, 'utf-8');
    log.info('cli-artesp-audit-run-finished', { ...result.summary, outputPath });
  } catch (err) {
    log.error('cli-artesp-audit-run-failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

main();
