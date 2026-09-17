# Task doc — Pedágio, OSM como fonte rápida (api, Wave 2)

Filled in as the work landed. What changed, how it was verified, and the
environment notes worth flagging.

## What changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | New `TollPlazaSource` enum (`antt \| osm`); `TollPlazaRecord.source` (`@default(antt)`) and `.tariff` (`Json?`); doc-comments updated to reflect the two-source model. |
| `prisma/migrations/20260916080000_t5_wave2_osm_source_tariff/migration.sql` | `CREATE TYPE` + `ADD COLUMN` × 2, additive only — **applied for real** against the local Postgres (see Verification). |
| `src/store/toll-plaza-store.ts` | `TollPlazaSource` type; `TollPlazaRecord.source`/`.tariff` (`unknown`, validated later at the boundary that needs it); `TollPlazaStatus.bySource`. |
| `src/store/prisma-toll-plaza-store.ts` | `status()` now also runs `groupBy(['source'])` and folds the result into `bySource: { antt, osm }` (always both keys). |
| `src/routes/plan.ts` | New private `toTariff()` — validates a `Json` value's shape (every `AxleCategory` key present and a finite number) before trusting it as `TariffByAxleCategory`, `undefined` otherwise; `toTollPlaza()` now calls it instead of hardcoding `undefined`. |
| `src/routes/admin-toll-plazas-status.ts` | Response gains `bySource`. |
| `tests/helpers/fakes.ts` | `DUTRA_TOLL_PLAZA_RECORDS` gains `source: 'antt'`/`tariff: null` on every row; new `OSM_TOLL_PLAZA_RECORD_WITH_TARIFF` fixture (same corridor geometry, `source: 'osm'`, a real 8-category tariff); `fakeTollPlazaStore`'s `status()` computes `bySource`. |
| `tests/plan.test.ts` | New `describe('OSM-sourced plazas carry a real tariff (j-20260916-y9)')` — 3 tests: an OSM row's tariff shows up and counts in `total` (AC-5); an ANTT row keeps behaving exactly as Wave 2 shipped it (AC-6); the two coexist correctly in one request (AC-7). |
| `tests/admin-toll-plazas-status.test.ts` | 2 pre-existing tests updated for the new `bySource` field; 1 new test for a mixed antt/osm count. |

No file outside `apps/api/**` was touched.

## Environment notes

This session's sandbox placed the work in its own isolated git worktree
(`.claude/worktrees/agent-a1eb865976d15f3a1`), on branch
`aipe/j-20260916-y9/api--pete-campbell` created directly from `origin/main`
(`git checkout -B aipe/j-20260916-y9/api--pete-campbell origin/main`) —
`git diff --name-only origin/main..HEAD` was empty before this unit's
commits. Same documented fallback the brief itself names for this exact
situation: pushed at the end to
`origin/aipe/j-20260916-y9/api--pete-campbell` via
`git push origin HEAD:refs/heads/aipe/j-20260916-y9/api--pete-campbell`.

`apps/api/.env` was written by hand in this worktree (not committed — the
file is gitignored), `DATABASE_URL` pointed at the same shared local
Postgres every other worktree in this session uses
(`postgresql://qualroteiro:qualroteiro@localhost:5433/qualroteiro?schema=public`
— confirmed reachable, and already carrying 277 `TollPlazaRecord` rows from
Wave 2/T5 before this unit touched anything), with placeholder values for
`ORS_API_KEY`/`CLERK_SECRET_KEY`/`GOOGLE_PLACES_API_KEY`
(`local-dev-placeholder-not-used-by-tests` — none of this unit's work
exercises those).

`pnpm install` + `pnpm -w build` were run once at the start to materialize
`node_modules` and `packages/tolls`'s `dist/` (Wave 1's build output) — this
worktree started with neither, and `apps/api`'s tests import
`@qualroteiro/tolls` from its built output.

## Verification

### Baseline (before this unit's changes), for the regression proof

```
$ pnpm --filter @qualroteiro/api test
 Test Files  8 passed (8)
      Tests  159 passed (159)
```

277 pre-existing `TollPlazaRecord` rows confirmed in the live database
before any change:

```
$ docker exec qualroteiro-postgres-1 psql -U qualroteiro -d qualroteiro -c \
    'SELECT count(*) FROM "TollPlazaRecord";'
 count
-------
   277
```

### After this unit's changes, all green

```
$ pnpm --filter @qualroteiro/api typecheck   # tsc -p tsconfig.test.json — clean
$ pnpm --filter @qualroteiro/api lint        # eslint src — clean
$ pnpm --filter @qualroteiro/api test        # vitest run
 Test Files  8 passed (8)
      Tests  163 passed (163)
```

163 = 159 pre-existing (unmodified in behaviour; 2 of them in
`admin-toll-plazas-status.test.ts` updated in place for the new `bySource`
field in their assertions, same test intent) + 4 net-new (1 in
`admin-toll-plazas-status.test.ts`, 3 in `plan.test.ts`'s new "OSM-sourced
plazas" block).

```
$ pnpm -w build
 Tasks:    8 successful, 8 total
```

### Real Postgres — migration, backfill, and round-trip

```
$ pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma --script
-- CreateEnum
CREATE TYPE "TollPlazaSource" AS ENUM ('antt', 'osm');
-- AlterTable
ALTER TABLE "TollPlazaRecord" ADD COLUMN     "source" "TollPlazaSource" NOT NULL DEFAULT 'antt',
ADD COLUMN     "tariff" JSONB;
```

Written by hand into
`prisma/migrations/20260916080000_t5_wave2_osm_source_tariff/migration.sql`
(next timestamp after Wave 2's `20260916070000_…`), then applied for real:

```
$ pnpm exec prisma migrate deploy
Datasource "db": PostgreSQL database "qualroteiro", schema "public" at "localhost:5433"
4 migrations found in prisma/migrations
Applying migration `20260916080000_t5_wave2_osm_source_tariff`
All migrations have been successfully applied.

$ pnpm exec prisma migrate status
Database schema is up to date!

$ pnpm exec prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

**Backfill proof** — the 277 pre-existing rows, immediately after the
migration, before any new row was written:

```
$ docker exec qualroteiro-postgres-1 psql -U qualroteiro -d qualroteiro -c \
    'SELECT source, count(*) FROM "TollPlazaRecord" GROUP BY source;'
 source | count
--------+-------
 antt   |   277

$ docker exec qualroteiro-postgres-1 psql -U qualroteiro -d qualroteiro -c \
    'SELECT count(*) FROM "TollPlazaRecord" WHERE tariff IS NULL;'
 count
-------
   277
```

Every existing row backfilled to `source: 'antt'`, `tariff: null` — zero
rows touched incorrectly, zero rows lost.

**Round-trip proof** — a temporary script
(`apps/api/.tmp-verify/osm-tariff-roundtrip.mjs`, run via `pnpm exec tsx`,
deleted after running — used a throwaway `verify-osm-y9-roundtrip` id,
cleaned up at the end) exercising `createPrismaTollPlazaStore` against the
live database:

```
antt count before: 277
status before: { count: 277, lastIngestedAt: 2026-09-16T19:38:31.261Z, bySource: { antt: 277, osm: 0 } }
status after insert: { count: 278, lastIngestedAt: 2026-09-17T02:09:13.779Z, bySource: { antt: 277, osm: 1 } }
round-tripped row found in listActive(): true
round-tripped row: {
  id: 'verify-osm-y9-roundtrip',
  ...
  source: 'osm',
  tariff: {
    car: 14.5, motorcycle: 5.5, truck_2_axle: 14.5, truck_3_axle: 21.75,
    truck_4_axle: 29, truck_5_axle: 36.25, truck_6_axle: 43.5, car_with_trailer: 14.5
  }
}
tariff deep-equal (value-level, order-independent): true
source is osm: true
antt count after insert (must be unchanged): 277
antt count unchanged: true
status after cleanup: { count: 277, lastIngestedAt: 2026-09-16T19:38:31.261Z, bySource: { antt: 277, osm: 0 } }
antt count final (must still be unchanged): 277
```

(The first run's naive `JSON.stringify` comparison printed `false` purely
because Postgres JSONB does not preserve key insertion order — fixed to an
order-independent, value-level comparison, which confirmed `true`. The
underlying data was never wrong; only the first check was too strict.)

This proves, against the real database, not a mock: an `osm` row with a
full 8-category tariff survives insert → read back through
`createPrismaTollPlazaStore` with every value intact; `source`/`tariff`
round-trip correctly typed; `bySource` aggregates correctly; and — the
critical zero-regression check — the `antt` row count is **277 before, 277
during, 277 after**, at no point disturbed by inserting, reading, or
deleting an `osm` row.

### `/routes/plan` behaviour proof (route-level, in `plan.test.ts`)

- A `source: 'osm'` row with `OSM_TOLL_PLAZA_RECORD_WITH_TARIFF.tariff` seeded
  alone → the matched plaza's `tariffByAxleCategory` equals the seeded
  tariff object exactly, and `tolls.total` is the seeded `car` rate (14.5,
  `VALID_BODY.vehicle.axleCategory` is `'car'`).
- `DUTRA_TOLL_PLAZA_RECORDS` (all `source: 'antt'`, `tariff: null`) seeded
  alone → every matched plaza's `tariffByAxleCategory` is `undefined`,
  `tolls.total` is `0` — identical assertions to what T5 Wave 2 already
  proved, now re-proven after this unit's change with the grown fixture
  shape.
- Both seeded together → ANTT plazas still `tariffByAxleCategory: undefined`,
  the OSM plaza carries its real tariff, and `total` reflects only the OSM
  plaza's `car` rate — proving convivência (orientation.md decision 5) at
  the route level, not just the database level.

## `git diff --name-only origin/main..HEAD`

Every path is under `apps/api/**` — no other package touched (see the PR
description for the exact file list at merge time).
