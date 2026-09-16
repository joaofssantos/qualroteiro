/**
 * `@qualroteiro/data-ingest` — background ingestion jobs for real-world data.
 *
 * First (and so far only) job: `ingest-toll-plazas` (Wave 3 of journey
 * `j-20260916-9y`) — downloads ANTT's monthly toll-plaza CSV, parses it, and
 * upserts it into `apps/api`'s Postgres via the `TollPlazaRecord` Prisma
 * model. This package does not define its own Prisma schema; see
 * `prisma-client.ts` for how it points at `apps/api/prisma/schema.prisma`
 * instead. Entrypoints: `cli.ts` (on-demand / seed run) and `worker.ts`
 * (BullMQ-scheduled monthly run) — see `README.md`.
 */

export { slugify, naturalKey } from './slug.js';
export { decodeAnttCsvBytes } from './decode.js';
export {
  parseAnttTollPlazaCsv,
  type ParseResult,
  type ParseError,
  type TollPlazaRecordInput,
} from './antt-csv.js';
export { downloadAnttTollPlazaCsv, ANTT_TOLL_PLAZA_CSV_URL } from './download.js';
export { ingestTollPlazas, type IngestSummary, type TollPlazaUpsertClient } from './ingest.js';
export {
  QUEUE_NAME,
  JOB_NAME,
  REPEATABLE_JOB_ID,
  MONTHLY_CRON_PATTERN,
  createRedisConnection,
  createIngestQueue,
  createIngestWorker,
  scheduleMonthlyIngest,
  attachWorkerLogging,
} from './queue.js';
