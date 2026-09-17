/**
 * `@qualroteiro/data-ingest` — background ingestion jobs for real-world data.
 *
 * Two jobs share this package:
 * - `ingest-toll-plazas` (Wave 3 of journey `j-20260916-9y`) — downloads
 *   ANTT's monthly toll-plaza CSV, parses it, and upserts it with
 *   `source: 'antt'`.
 * - `ingest-toll-plazas-osm` (Wave 3 of journey `j-20260916-y9`) — queries
 *   the Overpass API for Brazil-wide `barrier=toll_booth` nodes, clusters and
 *   parses them via `@qualroteiro/tolls` (Wave 1 of the same journey), and
 *   upserts them with `source: 'osm'` — a second, independent, redundant
 *   source that coexists with (never overwrites) the ANTT rows.
 *
 * Both upsert into `apps/api`'s Postgres via the `TollPlazaRecord` Prisma
 * model. This package does not define its own Prisma schema; see
 * `prisma-client.ts` for how it points at `apps/api/prisma/schema.prisma`
 * instead. Entrypoints: `cli.ts`/`cli-osm.ts` (on-demand / seed runs) and
 * `worker.ts` (BullMQ-scheduled monthly runs, one shared worker) — see
 * `README.md`.
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
export { ufFromStateName } from './br-states.js';
export {
  downloadOsmTollBoothNodes,
  buildOverpassQuery,
  OVERPASS_API_URL,
  OVERPASS_USER_AGENT,
  OVERPASS_TIMEOUT_SECONDS,
  type OverpassNode,
} from './overpass.js';
export {
  ingestOsmTollPlazas,
  type OsmIngestSummary,
  type OsmTollPlazaRecordInput,
  type OsmTollPlazaUpsertClient,
} from './osm-toll-plazas.js';
export {
  QUEUE_NAME,
  JOB_NAME,
  REPEATABLE_JOB_ID,
  MONTHLY_CRON_PATTERN,
  OSM_JOB_NAME,
  OSM_REPEATABLE_JOB_ID,
  OSM_MONTHLY_CRON_PATTERN,
  createRedisConnection,
  createIngestQueue,
  createIngestWorker,
  scheduleMonthlyIngest,
  scheduleMonthlyOsmIngest,
  attachWorkerLogging,
} from './queue.js';
