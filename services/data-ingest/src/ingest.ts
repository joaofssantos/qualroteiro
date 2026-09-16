/**
 * `ingest-toll-plazas`'s core logic: download (or accept injected text) ->
 * parse -> upsert -> structured log. No BullMQ or Redis dependency here —
 * that's `queue.ts`'s concern — so this function alone is what both the
 * on-demand CLI (`cli.ts`) and the scheduled worker (`worker.ts`) call, and
 * what the tests exercise directly against a fake Prisma client.
 */

import { parseAnttTollPlazaCsv, type TollPlazaRecordInput } from './antt-csv.js';
import { downloadAnttTollPlazaCsv } from './download.js';
import { log } from './logger.js';

/**
 * The minimal slice of `PrismaClient` this job needs — narrow on purpose so
 * tests can pass an in-memory fake instead of a real Prisma Client (and so
 * this module doesn't need `@prisma/client`'s generated types to compile
 * before `prisma generate` has run once).
 */
export interface TollPlazaUpsertClient {
  tollPlazaRecord: {
    upsert(args: {
      where: { id: string };
      create: TollPlazaRecordInput;
      update: Omit<TollPlazaRecordInput, 'id'>;
    }): Promise<unknown>;
  };
}

export interface IngestOptions {
  /** Injected CSV text, bypassing the network — what the tests use. */
  readonly csvText?: string;
  /** Injected "now", stamped as `ingestedAt`. Defaults to `new Date()`. */
  readonly now?: Date;
}

export interface IngestSummary {
  readonly totalRowsRead: number;
  readonly upserts: number;
  readonly inactiveSkipped: number;
  readonly errors: number;
  readonly errorDetails: readonly { readonly line: number; readonly reason: string }[];
}

/**
 * Runs one full ingestion pass: download (unless `csvText` is injected),
 * parse, filter to active plazas, and `upsert` each one by its natural-key
 * `id` (see `slug.ts`) — idempotent by construction: re-running with the
 * same CSV re-upserts the same ids (only `ingestedAt` and, in practice,
 * nothing else changes), never inserts a duplicate row.
 *
 * A single bad row (unparseable number, wrong column count) is counted in
 * `errorDetails` and skipped — it does not abort the whole run, so one
 * malformed line in a 277-row file never blocks the other 276 from being
 * ingested. An `upsert` that throws (e.g. a transient DB error) is likewise
 * caught per-record, counted as an error, and the loop continues.
 */
export async function ingestTollPlazas(
  prisma: TollPlazaUpsertClient,
  options: IngestOptions = {},
): Promise<IngestSummary> {
  const now = options.now ?? new Date();
  const startedAt = Date.now();

  const csvText = options.csvText ?? (await downloadAnttTollPlazaCsv());
  const parsed = parseAnttTollPlazaCsv(csvText, now);

  const errorDetails: { line: number; reason: string }[] = parsed.errors.map((e) => ({
    line: e.line,
    reason: e.reason,
  }));
  let upserts = 0;

  for (const record of parsed.activeRecords) {
    try {
      const { id, ...rest } = record;
      await prisma.tollPlazaRecord.upsert({
        where: { id },
        create: record,
        update: rest,
      });
      upserts++;
    } catch (err) {
      errorDetails.push({
        line: -1,
        reason: `upsert failed for id="${record.id}": ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const summary: IngestSummary = {
    totalRowsRead: parsed.totalRows,
    upserts,
    inactiveSkipped: parsed.inactiveSkipped,
    errors: errorDetails.length,
    errorDetails,
  };

  log.info('ingest-run-complete', {
    ...summary,
    durationMs: Date.now() - startedAt,
  });

  return summary;
}
