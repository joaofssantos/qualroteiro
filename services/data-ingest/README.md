# @qualroteiro/data-ingest

Background ingestion jobs that populate real-world data into `apps/api`'s
Postgres database.

## `ingest-toll-plazas` (Wave 3 of journey `j-20260916-9y`)

Downloads ANTT's official, monthly toll-plaza CSV, parses it, and upserts it
into `apps/api`'s `TollPlazaRecord` table.

- **Source**: the CSV resource of
  `dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d`
  ("Praça de Pedágio"), fixed URL in `src/download.ts`
  (`ANTT_TOLL_PLAZA_CSV_URL`). Chosen over the dataset's JSON resource
  because the coordinator had already inspected and specified the CSV's
  exact columns; no reason to add a second format to support.
- **Encoding**: the file is ISO-8859-1 (Windows-1252), NOT UTF-8 — confirmed
  by downloading and inspecting the real file. See `src/decode.ts`.
- **Filter**: only rows with `situacao === 'Ativo'` are upserted. Everything
  else is counted as `inactiveSkipped` in the run's structured log and
  otherwise dropped — see the **known limitation** below.
- **Natural key** (`TollPlazaRecord.id`): a slug of
  `concessionaire + plaza name + highway + km`, algorithm documented in full
  in `src/slug.ts`'s doc-comment (NFKD-normalize, strip diacritics,
  lowercase, collapse non-alphanumeric runs to `-`, trim). Verified unique
  across all 277 real rows in the September-2026 CSV.
- **lat/lng**: `latitude` -> `lat`, `longitude` -> `lng`, same axis, never
  swapped — see `tests/antt-csv.test.ts`'s "CRITICAL" test, which asserts
  this against the real "Conselheiro Josino" row
  (`latitude=-21.552594, longitude=-41.331597`).
- **Idempotent**: `prisma.tollPlazaRecord.upsert` keyed on the natural-key
  `id`. Running the job twice against the same CSV updates the same rows
  (bumping `ingestedAt`) rather than creating duplicates — proved in
  `tests/ingest.test.ts` with a fake Prisma client, and (when Postgres was
  locally available) against the real database — see the job's own summary
  for whether that real run happened in a given environment.
- **Prisma schema**: this package does NOT define its own — see
  `src/prisma-client.ts`'s doc-comment for exactly how
  `prisma generate --schema=../../apps/api/prisma/schema.prisma` is wired.

### Known limitation

The real ANTT CSV (checked 2026-09-16) has **zero** inactive rows — all 277
are `Ativo`. Because this job only ever upserts rows currently read as
`Ativo` (see "Filter" above), a plaza that *becomes* inactive in some future
monthly CSV is simply skipped by that run rather than being written with
`active: false` — its existing DB row is left stale (`active: true`) instead
of being flipped. Low blast radius today (nothing to trigger it yet); worth
revisiting if/when ANTT's dataset actually starts carrying inactive rows.

### Running it

```sh
# On-demand / initial seed / manual testing — no Redis needed:
pnpm --filter @qualroteiro/data-ingest ingest:once

# Long-running worker: registers the monthly BullMQ repeatable schedule
# (1st of every month, 06:00 UTC) and processes it when it fires. Needs
# REDIS_URL.
pnpm --filter @qualroteiro/data-ingest worker
```

Both need `DATABASE_URL` (see `.env.example`, same value as `apps/api`'s).

## Scripts

- `build` — `tsc -p tsconfig.json`
- `lint` — `eslint src`
- `typecheck` — `tsc -p tsconfig.test.json`
- `test` — `vitest run`
- `prisma:generate` (also runs on `postinstall`) — `prisma generate --schema=../../apps/api/prisma/schema.prisma`
- `ingest:once` — one-off run of `ingest-toll-plazas`, no Redis required
- `worker` — long-running BullMQ worker + monthly schedule registration
