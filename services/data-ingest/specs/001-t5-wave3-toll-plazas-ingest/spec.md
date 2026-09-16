# spec-kit — T5 Wave 3 (root/services/data-ingest): Ingestão real de praças de pedágio

**Journey**: `j-20260916-9y` (T5)
**Unit**: `qualroteiro/root`, Wave 3 (second round of this same unit) — depends
on Wave 1 (`packages/tolls` + `services/data-ingest` scaffold, this unit,
already `merged`) AND Wave 2 (`qualroteiro/api`, `TollPlazaRecord` Prisma
model + `TollPlazaStore` + `GET /admin/toll-plazas-status`, already
`merged`).
**Scope**: `services/data-ingest` only. No `apps/api`, `apps/web`,
`packages/**`, `turbo.json`, `pnpm-workspace.yaml` or root `package.json`.
**SDD route**: `aipe skill match --task-type feature --size medium` returned
`sdd=none — no SDD kit is installed`, same as Wave 1 and Wave 2 of this
journey. This artifact set follows the format Wave 2 (`apps/api`) already
established for this journey — `spec.md` → `plan.md` → a task doc — per the
orientation's own instruction to replicate a prior real SDD's format.

---

## Problem

`TollPlazaRecord` (Wave 2) exists as an empty table — Wave 2 deliberately
left it unpopulated (`/routes/plan` already works correctly against zero
rows). Nothing writes real data into it yet. This unit is that writer: a job
that downloads ANTT's official, monthly toll-plaza dataset, parses it
correctly (including its non-UTF-8 encoding), and upserts it into the table
Wave 2 already built — idempotently, so a monthly re-run updates existing
plazas instead of duplicating them.

## Users and their stories

**A traveller planning a route** sees real toll plazas (not just an empty
`tolls.plazas: []`) once this job has run at least once — this is the unit
that actually makes Wave 2's plumbing carry real data.

**An operator** runs the job on demand (`pnpm ingest:once`) to seed a fresh
environment, or lets the scheduled BullMQ worker (`pnpm worker`) re-run it
automatically on the 1st of every month, matching ANTT's own publishing
cadence — and reads `GET /admin/toll-plazas-status` (Wave 2) afterward to
confirm the count without needing database access.

## Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | The job downloads the real ANTT CSV and decodes it as ISO-8859-1 (not UTF-8) — proven with real bytes captured from the live download, not a synthetic UTF-8 fixture. |
| AC-2 | Parsing filters to `situacao === 'Ativo'` — inactive rows are counted (`inactiveSkipped`) and dropped, not upserted. Proven with a fixture that includes an inactive row (real dataset had zero to sample — see "Deliberate limitations"). |
| AC-3 | **Critical**: `latitude` → `lat`, `longitude` → `lng`, same axis, never swapped — proven against the real "Conselheiro Josino" row (`latitude=-21.552594, longitude=-41.331597`), both in a unit test and, when Postgres was locally reachable, in the real database. |
| AC-4 | The natural-key slug (`TollPlazaRecord.id`) is documented exactly (algorithm, casing, separator, accent handling) and proven unique and stable — same input always produces the same id, and running the job twice against the same CSV does not create duplicate rows. |
| AC-5 | Upserts go through a Prisma Client generated from `apps/api/prisma/schema.prisma` — no second schema definition in this package. |
| AC-6 | A monthly BullMQ repeatable job (`ingest-toll-plazas`) is registered, plus an on-demand path (`pnpm ingest:once`) that needs no Redis — for seeding and manual testing. |
| AC-7 | Every run logs, as structured JSON: rows read, upserts made, inactive rows skipped, and any errors. |
| AC-8 | `.env.example` documents `DATABASE_URL`/`REDIS_URL`, reusing `apps/api`'s values. |
| AC-9 | When Postgres and Redis were both locally reachable, the job was run for real against the live ANTT CSV, and `GET /admin/toll-plazas-status` was checked to confirm the real count — see the task doc for the actual numbers observed in this environment. |

## Out of scope

- **Tariff by axle category (Fase 2)** — ANTT's dataset carries none; a
  separate, future journey.
- **Deactivating a plaza that was previously ingested but has since become
  inactive** — see "Deliberate limitations" below.
- **A dedicated audit-log table for ingestion runs** — structured console
  logging is the documented, sufficient V1 (spec's own wording).
- **Any change to `apps/api` or `apps/web`** — Wave 2 already built what this
  job writes into and what the API reads from.

## Deliberate limitations

- **Inactive rows are skipped, not written with `active: false`.** This
  unit's brief is explicit ("Filtra `situacao === 'Ativo'`" as a step before
  the upsert; the acceptance wording is "filtra inativa"), so a plaza already
  in the database that ANTT's *next* monthly CSV marks inactive is simply
  never touched by that run — its row is left stale (`active: true`) rather
  than flipped to `false`. Low blast radius today: the real September-2026
  CSV has zero inactive rows among its 277. Worth revisiting if ANTT's
  dataset ever actually starts carrying inactive rows in volume.
- **No retry/backoff around the CSV download.** A failed `fetch` throws and
  the run ends with a non-zero exit (CLI) or a failed BullMQ job (worker,
  which BullMQ itself can be configured to retry) — no custom retry logic was
  added in this unit.
