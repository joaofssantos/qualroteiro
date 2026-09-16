# Implementation Plan: T5 Wave 3 (services/data-ingest) — Ingestão real de praças

**Spec**: [`spec.md`](./spec.md)
**Unit**: `qualroteiro/root` · **Journey**: `j-20260916-9y`

---

## Summary

A download step (real ANTT CSV, decoded as ISO-8859-1), a pure-function
parser (CSV text → typed rows, filtering inactive, building the natural-key
slug), an orchestrator (`ingestTollPlazas`) that upserts through an injected
Prisma-shaped client and emits one structured log line per run, and two
entrypoints: `cli.ts` (on-demand, no Redis) and `worker.ts` (BullMQ,
scheduled monthly + processes manual enqueues).

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6+ (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) — same `tsconfig.base.json` as every other package |
| Runtime | Node ≥ 20 (developed/verified on Node 22), ESM |
| CSV parsing | Hand-rolled `split(';')`, no library — the real file has no quoted fields or embedded delimiters (confirmed by inspecting all 277 real rows: every one splits into exactly 13 columns) |
| Scheduling | BullMQ 5.81 + ioredis 5.11 (pinned to well-established majors; bullmq 6 exists but re-architects its Redis backend behind peer deps — not worth the risk for a single repeatable job) |
| Persistence | `@prisma/client`/`prisma` pinned to `^5.20.0`, the exact range `apps/api` uses — see D-802 |
| Test runner | vitest 2.x — all tests run against fakes/fixtures, no live Postgres/Redis required to pass `pnpm test` |

---

## Key Decisions

**D-801 — Natural-key slug algorithm, fully specified (Wave 2 left this
unspecified on purpose, deferring to this unit).** `naturalKey([
concessionaire, name, highway, km])`: each field is Unicode NFKD-normalized,
combining diacritical marks (U+0300–U+036F) stripped, lowercased, every run
of non-`[a-z0-9]` characters collapsed to a single `-`, and leading/trailing
`-` trimmed; the four per-field slugs are joined with `-`, dropping any
field that slugified to empty. Verified unique across all 277 rows of the
real September-2026 CSV (see `src/slug.ts`'s doc-comment for the full
rationale and a worked example).

**D-802 — `@prisma/client`/`prisma` versions pinned to match `apps/api`
EXACTLY (`^5.20.0`), not "close enough".** This is what makes "one schema,
one generated client" actually hold in practice: pnpm's content-addressable
store resolves two workspace packages' identical dependency pair to one
physical directory, so `prisma generate --schema=../../apps/api/prisma/schema.prisma`
run from this package writes into the SAME `node_modules/.pnpm/@prisma+client@.../`
directory `apps/api`'s own `prisma generate` writes into — confirmed
empirically via `pnpm install`'s postinstall log (both packages' postinstall
step printed the identical destination path). If the versions ever drift,
pnpm would give each package its own physical copy instead — still correct
(both still read the same schema file), just duplicated on disk; the pin is
what avoids that, not a correctness requirement.

**D-803 — inactive rows are filtered out of the upsert set entirely, not
written with `active: false`.** See `spec.md`'s "Deliberate limitations" for
the full reasoning; this is the parser's job (`parseAnttTollPlazaCsv`
returns `inactiveSkipped` as a count, `activeRecords` containing only
`situacao === 'Ativo'` rows) rather than the orchestrator's, so it is
provable by testing the parser alone.

**D-804 — `ingestTollPlazas` takes a narrow `TollPlazaUpsertClient`
interface, not the real generated `PrismaClient` type.** One method
(`tollPlazaRecord.upsert`), typed against this package's own
`TollPlazaRecordInput`. This is what lets `tests/ingest.test.ts` exercise
real upsert/idempotency semantics (create-vs-update branching, natural-key
collision behaviour) with an in-memory `Map`-backed fake, with no dependency
on `prisma generate` having run or a live database being reachable, while
the real `PrismaClient` still satisfies the interface structurally at the
`cli.ts`/`worker.ts` call sites.

**D-805 — a single bad row, or a single failed upsert, does not abort the
run.** `parseAnttTollPlazaCsv` collects malformed-row errors and keeps
parsing; `ingestTollPlazas` catches per-record `upsert` failures and keeps
looping. One malformed line (or one transient DB error on one row) out of
277 should not silently lose the other 276 — it should be counted and
logged instead.

**D-806 — the CLI (`cli.ts`) and the worker (`worker.ts`) are separate
entrypoints, not one script with a flag.** `cli.ts` never touches Redis at
all (no `REDIS_URL` needed to run it) — this is deliberate: seeding a fresh
environment, or running the job manually during testing, should not require
standing up Redis first. `worker.ts` is the only file that imports
`queue.ts`.

---

## Data flow

```
downloadAnttTollPlazaCsv()  ->  decodeAnttCsvBytes(bytes)  ->  csvText
                                                                  |
                                                                  v
                                        parseAnttTollPlazaCsv(csvText, now)
                                                                  |
                                            +---------------------+---------------------+
                                            |                                           |
                                    activeRecords[]                              inactiveSkipped, errors
                                            |
                                            v
                              prisma.tollPlazaRecord.upsert({ where: { id }, create, update })
                                            |
                                            v
                                   structured log line (log.info('ingest-run-complete', …))
```

---

## Implementation order (TDD, RED → GREEN per step)

1. `src/slug.ts` — `slugify`/`naturalKey`, tested against real field values
   from the CSV (`tests/slug.test.ts`).
2. `src/decode.ts` — ISO-8859-1 byte decoding, tested against real captured
   bytes (`tests/decode.test.ts`).
3. `src/antt-csv.ts` — the parser, tested against
   `tests/fixtures/sample-plazas.csv` (4 real rows + 1 synthetic inactive
   row) — mapping, the critical lat/lng assertion, inactive filtering,
   malformed-row handling, id stability across two parses
   (`tests/antt-csv.test.ts`).
4. `src/download.ts` — real URL constant + injectable-`fetch` download
   function (not unit-tested against the network; exercised for real in
   Verification).
5. `src/prisma-client.ts` — lazy singleton `PrismaClient` factory pointed at
   the schema Wave 2 built.
6. `src/logger.ts` — structured JSON logging helper.
7. `src/ingest.ts` — the orchestrator, tested against a fake Prisma client
   (`tests/ingest.test.ts`): upsert counts, the critical lat/lng assertion
   again (end-to-end through the orchestrator this time), real idempotency
   (two runs, same ids, `createCalls` stays flat on the second run), and
   per-record error isolation.
8. `src/queue.ts` — BullMQ queue/worker/schedule wiring (smoke-tested for
   real against local Redis in Verification, not unit-tested — constructing
   an `IORedis` instance at import time would make `vitest run` depend on a
   live Redis connection, which the spec does not require for
   `typecheck/lint/test` to pass).
9. `src/cli.ts`, `src/worker.ts` — the two entrypoints.
10. `src/index.ts` — public re-exports.
11. `.env.example`, `README.md` — documentation.
12. Real verification against local Postgres/Redis — see the task doc.
