# @qualroteiro/data-ingest

Background ingestion jobs that populate real-world data into `apps/api`'s
Postgres database.

**Status: scaffold only.** This package builds, typechecks, lints, and tests
green, but has no ingestion logic yet — `ping()` is a placeholder export that
exists so the pipeline has something real to exercise.

## Planned (Wave 3 of journey `j-20260916-9y`)

A BullMQ job, `ingest-toll-plazas`, that downloads the ANTT's official
toll-plaza dataset (`dados.antt.gov.br/dataset/praca-de-pedagio`), parses it,
filters to active plazas, and upserts them via a Prisma Client pointed at
`apps/api/prisma/schema.prisma` — this package does **not** define its own
Prisma schema, to avoid two sources of truth for the same database. See
`.aipe/journeys/j-20260916-9y/orientation.md` for the full plan.

## Scripts

- `build` — `tsc -p tsconfig.json`
- `typecheck` — `tsc -p tsconfig.test.json`
- `test` — `vitest run`
