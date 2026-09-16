/**
 * `@qualroteiro/data-ingest` — background ingestion jobs for real-world data.
 *
 * Currently a scaffold. The first real job (Wave 3 of j-20260916-9y) will
 * download the ANTT toll-plaza dataset, parse it, and upsert it into
 * `apps/api`'s Postgres via the `TollPlazaRecord` Prisma model — this
 * package does not define its own Prisma schema; it generates a client
 * pointed at `apps/api/prisma/schema.prisma` so there is a single source of
 * truth for the schema. See
 * `.aipe/journeys/j-20260916-9y/orientation.md` for the full plan.
 */

/**
 * Scaffold sanity check.
 *
 * Placeholder until the Wave 3 ingestion job lands — exists so the package
 * has a real export and `build`/`typecheck`/`test` have something to exercise.
 */
export function ping(): 'pong' {
  return 'pong';
}
