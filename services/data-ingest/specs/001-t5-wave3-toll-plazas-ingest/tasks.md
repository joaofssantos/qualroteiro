# Task doc — T5 Wave 3 (services/data-ingest): Ingestão real de praças de pedágio

Filled in as the work landed. What changed, how it was verified, and the
environment notes worth flagging.

## What changed

| File | Change |
|---|---|
| `src/slug.ts` | `slugify`/`naturalKey` — the documented natural-key algorithm (D-801). |
| `src/decode.ts` | `decodeAnttCsvBytes` — `Buffer#toString('latin1')`, the ISO-8859-1 decoding step, isolated and tested on its own. |
| `src/antt-csv.ts` | `parseAnttTollPlazaCsv` — header validation, `;`-split parsing, `situacao === 'Ativo'` filter, number parsing (`,`/`.` decimal tolerant), natural-key assembly, per-row error collection. |
| `src/download.ts` | `downloadAnttTollPlazaCsv` — injectable-`fetch` download of the real ANTT CSV URL, decoded via `decode.ts`. |
| `src/prisma-client.ts` | Lazy singleton `PrismaClient` factory, pointed at `apps/api/prisma/schema.prisma` via the package's `prisma:generate`/`postinstall` script. |
| `src/logger.ts` | Structured JSON console logging (`log.info`/`log.error`). |
| `src/ingest.ts` | `ingestTollPlazas` — the orchestrator: download-or-injected-text → parse → per-record `upsert` (with per-record error isolation) → structured summary log. |
| `src/queue.ts` | BullMQ wiring — `createRedisConnection`, `createIngestQueue`, `scheduleMonthlyIngest` (cron `0 6 1 * *`, stable `jobId` so re-registration is a no-op), `createIngestWorker`, `attachWorkerLogging`. |
| `src/cli.ts` | On-demand entrypoint (`pnpm ingest:once`) — no Redis dependency. |
| `src/worker.ts` | Long-running entrypoint (`pnpm worker`) — registers the schedule, starts the worker, handles `SIGINT`/`SIGTERM`. |
| `src/index.ts` | Public re-exports (replaces the Wave 1 scaffold's `ping()`). |
| `package.json` | New scripts (`lint`, `prisma:generate`, `postinstall`, `ingest:once`, `worker`); new deps (`@prisma/client`, `bullmq`, `ioredis`) pinned per D-802; new devDeps (`eslint` stack, `prisma`, `tsx`, `@types/node`, matching `apps/api`'s versions). |
| `eslint.config.js` | New — mirrors `apps/api/eslint.config.js` (this package had no lint config or script at all before this unit). |
| `.env.example` | New — `DATABASE_URL`/`REDIS_URL`, values copied from `apps/api/.env.example`. |
| `tests/slug.test.ts`, `tests/decode.test.ts`, `tests/antt-csv.test.ts`, `tests/ingest.test.ts` | New — 22 tests total (see Verification). |
| `tests/fixtures/sample-plazas.csv` | New — 4 real rows + 1 synthetic inactive row (see "Fixture provenance"). |
| `tests/index.test.ts` | Deleted — the Wave 1 scaffold's placeholder `ping()` test, superseded by real coverage. |
| `README.md` | Rewritten for the real job (was "scaffold only"). |
| `pnpm-lock.yaml` (root) | Updated for the new dependencies — same kind of necessary root-level touch Wave 1 made for the initial scaffold. |

No file outside `services/data-ingest/` (and the root lockfile) was changed.
`apps/api/prisma/schema.prisma` was NOT touched — this unit reads it via
`--schema=`, does not modify it.

## Fixture provenance

`tests/fixtures/sample-plazas.csv`'s first 4 data rows
(Conselheiro Josino, Serrinha, São Gonçalo, P1 ALEXÂNIA) are copied verbatim
from the real ANTT CSV downloaded on 2026-09-16
(`dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d`, resource
`9aa29243-c54c-4084-bc3d-c44a75c9bd7e`). That download was inspected in full:
277 data rows, header matches the brief's columns exactly, `file(1)` reports
"ISO-8859 text", and every `situacao` value is `'Ativo'` — **zero inactive
rows exist in the real dataset right now**. Per the brief's own instruction
for this situation, the fixture's 5th row
(`CONCESSIONARIA TESTE;Praça Teste Inativa;...;Inativo;...`) is synthetic,
clearly named so it cannot be mistaken for real ANTT data, added specifically
to prove the inactive-filter actually filters something.

The exact byte sequence used in `tests/decode.test.ts`'s "CRITICAL" ISO-8859-1
test was captured directly from that same real download (`curl` + a byte
inspection script), not fabricated.

## Verification

Run from `services/data-ingest`, all green:

```
pnpm typecheck   # tsc -p tsconfig.test.json — clean
pnpm lint        # eslint src — clean
pnpm build       # tsc -p tsconfig.json — clean
pnpm test        # vitest run — 22 passed (4 files: slug, decode, antt-csv, ingest)
```

`pnpm -w build` (turbo, all 8 workspace packages, this package included) —
8/8 tasks succeeded.

### The critical lat/lng test

`tests/antt-csv.test.ts`'s and `tests/ingest.test.ts`'s
`'CRITICAL: maps latitude -> lat and longitude -> lng WITHOUT swapping axes'`
tests assert, against the real "Conselheiro Josino" row
(`AUTOPISTA FLUMINENSE;Conselheiro Josino;...;BR-101;RJ;40.5;...;-21.552594;-41.331597`):

```
lat === -21.552594   (from the CSV's `latitude` column)
lng === -41.331597   (from the CSV's `longitude` column)
```

Both a unit test of the parser alone and an end-to-end test through
`ingestTollPlazas` (via the fake Prisma client) assert this exactly, not with
a "looks plausible" range check — the doc-comment explains why: Brazil's
real lat/lng magnitudes are close enough that a swapped-axis bug would not be
obviously wrong on a map.

### Real Postgres + Redis — the job was run for real, not just against mocks

Both were locally reachable this session: Postgres
(`postgis/postgis:16-3.4`, container `qualroteiro-postgres-1`,
`localhost:5433`, already carrying Wave 2's `TollPlazaRecord` table — schema
confirmed via `docker exec ... psql -c '\dt'` before running anything) and
Redis (`redis:7-alpine`, `localhost:6379`, confirmed with `redis-cli ping` →
`PONG`).

**Run 1** (`pnpm ingest:once`, real ANTT CSV downloaded over the network):

```
{"event":"ingest-run-complete","totalRowsRead":277,"upserts":277,"inactiveSkipped":0,"errors":0,"durationMs":2542}
```

Confirmed directly in Postgres:

```sql
SELECT count(*), max("ingestedAt") FROM "TollPlazaRecord";
 count |           max
-------+-------------------------
   277 | 2026-09-16 19:26:02.078
```

```sql
SELECT id, concessionaire, name, highway, lat, lng FROM "TollPlazaRecord" WHERE name = 'Conselheiro Josino';
                          id                          |    concessionaire    |        name        | highway |    lat     |    lng
-------------------------------------------------------+----------------------+---------------------+---------+------------+------------
 autopista-fluminense-conselheiro-josino-br-101-40-5 | AUTOPISTA FLUMINENSE | Conselheiro Josino | BR-101  | -21.552594 | -41.331597
```

**Run 2** (`pnpm ingest:once` again, same real CSV) — idempotency, against the
real database, not a mock:

```
{"event":"ingest-run-complete","totalRowsRead":277,"upserts":277,"inactiveSkipped":0,"errors":0,"durationMs":2303}
```

```sql
SELECT count(*), max("ingestedAt") FROM "TollPlazaRecord";
 count |           max
-------+-------------------------
   277 | 2026-09-16 19:26:13.893
```

Count unchanged (277 → 277, no duplicates); `ingestedAt` advanced to the
second run's timestamp — every row went through `upsert`'s update branch,
not create.

**`GET /admin/toll-plazas-status`** (Wave 2's endpoint), a real `apps/api`
dev server started against the same Postgres (on a spare port, `3099`, since
another concurrent session in this shared environment already held the
default `3000` — see "Environment notes"):

```json
{"count":277,"lastIngestedAt":"2026-09-16T19:26:13.893Z"}
```

Matches the real row count (277, the real ANTT dataset's active-plaza count
at the time of download) and the second run's exact timestamp.

**BullMQ worker path** (`pnpm worker`'s underlying pieces), smoke-tested
against the real local Redis with a throwaway script (not committed):
`scheduleMonthlyIngest` registered one repeatable job
(`{"pattern":"0 6 1 * *","next":1790845200000}` — 2026-10-01T06:00:00Z, the
next 1st-of-month after this run), re-confirmed idempotent by construction
(stable `jobId`); a manually-enqueued job was picked up and processed by
`createIngestWorker`, running `ingestTollPlazas` for real a third time
(`upserts: 277`, count still 277 in Postgres afterward) and emitting both the
ingest's own `ingest-run-complete` log line and the worker's
`worker-job-completed` line.

## Environment notes

**Branch was stale at session start; reset onto the real, merged
`origin/main`.** The branch handed off
(`aipe/j-20260916-9y/root--lane-pryce`) still pointed at its own Wave 1 tip
(pre-merge), while `origin/main` had already merged both Wave 1 (PR #32) and
Wave 2 (PR #33). `git reset --hard origin/main` before starting this unit's
work — confirmed via `git diff --name-only origin/main..HEAD` being empty
right after.

**`apps/api/.env` and `services/data-ingest/.env` did not exist in this
worktree** — both written by hand, pointing at the same local Postgres/Redis
every other unit in this session's environment already used
(`postgresql://qualroteiro:qualroteiro@localhost:5433/qualroteiro?schema=public`,
`redis://localhost:6379` — confirmed reachable and already carrying the
`TollPlazaRecord` table before writing anything). Placeholder values only for
`ORS_API_KEY`/`CLERK_SECRET_KEY`/`GOOGLE_PLACES_API_KEY` in `apps/api/.env`
(needed only so the server process boots; no real external call was made).
Both `.env` files are gitignored, not committed.

**Port 3000 was already held by another concurrent session's `apps/api`
process** (same shared machine, a different worktree — confirmed via `ps`
that its start time predated this session). Rather than kill a process this
unit does not own, the verification `apps/api` instance was started on
`PORT=3099` instead, and shut down again once `GET /admin/toll-plazas-status`
had been checked.

## Design decisions within scope

- **The natural-key slug is now fully specified and tested (D-801)** —
  Wave 2 deliberately left this unspecified, deferring to this unit, which
  is where it actually gets exercised against real, messy CSV values
  (accents, mixed casing, `/` and `.` in source fields).
- **`ingestTollPlazas` never imports `queue.ts` or constructs an `IORedis`
  instance** — the core logic is fully testable, and runnable via `cli.ts`,
  with no Redis dependency at all.
- **A single bad row, or one failed upsert, never aborts the run (D-805)** —
  counted and logged instead, so 276 good rows are never lost because of one
  bad one.

## Not done, on purpose

Tariff data (Fase 2), deactivating a plaza that has since gone inactive in a
later CSV (see `spec.md`'s "Deliberate limitations"), and a dedicated audit
table for ingestion runs — all out of scope per `spec.md`. No file outside
`services/data-ingest/` (plus the root lockfile) was touched.
