# Implementation Plan: Pedágio, OSM como fonte rápida (api, Wave 2)

**Spec**: [`spec.md`](./spec.md)
**Unit**: `qualroteiro/api` · **Journey**: `j-20260916-y9`

---

## Summary

One additive migration on the existing `TollPlazaRecord` table (`source`
enum column, `@default(antt)`; `tariff Json?`), one conversion function
(`toTariff()` in `routes/plan.ts`) that validates a `Json` value back into
`@qualroteiro/tolls`'s `TariffByAxleCategory`, and one extended read
(`GET /admin/toll-plazas-status`'s `bySource`). No new port, no new adapter,
no new route — this unit extends T5 Wave 2's shapes rather than adding new
ones.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6+ (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) — unchanged from Wave 2. |
| Persistence | Prisma 5.22 + PostgreSQL — one additive migration (`ADD COLUMN` × 2 + `CREATE TYPE`, no `DROP`/`ALTER … TYPE` on any existing column), **applied against the real local Postgres** (`postgis/postgis:16-3.4`, `localhost:5433`, shared with other worktrees this session — see the task doc's "Verification"). |
| New runtime deps | **None.** `@qualroteiro/tolls` (already a dependency) exports the `AXLE_CATEGORIES`/`TariffByAxleCategory` this unit needs. |

---

## Key Decisions

**D-801 — `source` is a Prisma enum (`TollPlazaSource: antt | osm`) with
`@default(antt)`, not a plain `String`.** Orientation.md's own decisions
list every source this journey (and the next: ARTESP/Power BI) plans to
introduce; a closed enum makes a typo (`'atnt'`) a migration-time/insert-time
error instead of a silently-mis-tagged row a query would never find. The
default is what makes this migration non-breaking: every one of the 277
existing rows backfills as `'antt'` with zero explicit `UPDATE`, and zero
risk of a null/missing value breaking `TollPlazaRecord.source`'s NOT NULL
constraint.

**D-802 — `tariff` is `Json?` (nullable), matching T5 Wave 2's precedent of
"absent, not a lie" for missing data.** ANTT rows keep `tariff: null`
forever (ANTT's dataset has none); OSM rows get `null` only when
`parseOsmCharge` itself returned `null` for an unrecognised `charge` format
(Wave 1's own documented limit) — Wave 3's future ingestion job writing that
`null` through is expected, not a bug for this unit to prevent.

**D-803 — the JSON → `TariffByAxleCategory` conversion lives in
`routes/plan.ts` as a private `toTariff()`, not in `@qualroteiro/tolls` or
the store.** `@qualroteiro/tolls` is out of scope for this unit (Wave 1
already shipped and merged); adding a function there would touch a package
this journey's own sequencing says is done. The store
(`toll-plaza-store.ts`) stays a thin, Prisma-free port — its `tariff: unknown`
field deliberately punts validation to the one place that already owns
"turn a persisted row into `@qualroteiro/tolls`'s domain shape"
(`toTollPlaza()`, which already existed for exactly this purpose in Wave 2).

**D-804 — malformed `tariff` JSON resolves to `undefined`, never throws.**
Same "skip, don't crash" contract Wave 1's `parseOsmCharge` already
established for the OSM `charge` tag itself — a `/routes/plan` request must
not 500 because one row's JSON is unexpected shape. `toTariff()` checks
every `AxleCategory` key is present and a finite number; anything else
(`null`, a non-object, a missing key, a string value) returns `undefined`,
and the plaza behaves exactly like an untariffed ANTT row.

**D-805 — `bySource`'s two keys are hardcoded (`{ antt: 0, osm: 0 }` as the
starting accumulator), not derived from the Prisma enum at runtime.**
Simpler than reflecting over `Prisma.TollPlazaSource` for a fixed set of two
values known at compile time; documented in `spec.md`'s "Deliberate
limitations" as the follow-up cost of ever adding a third source.

**D-806 — the migration is written by hand from `prisma migrate diff`'s
output, same non-interactive path Wave 2 used** (`prisma migrate dev`
requires a TTY this session doesn't have). Verified identical in shape to
what `prisma migrate diff --from-schema-datasource … --to-schema-datamodel
…  --script` produces — see the task doc.

---

## Files touched

| File | Change |
|---|---|
| `prisma/schema.prisma` | `TollPlazaSource` enum; `TollPlazaRecord.source`/`.tariff`; doc-comments updated. |
| `prisma/migrations/20260916080000_t5_wave2_osm_source_tariff/migration.sql` | The DDL — applied for real (see task doc). |
| `src/store/toll-plaza-store.ts` | `TollPlazaSource` type; `TollPlazaRecord.source`/`.tariff`; `TollPlazaStatus.bySource`. |
| `src/store/prisma-toll-plaza-store.ts` | `status()` now also runs a `groupBy(['source'])` and folds it into `bySource`. |
| `src/routes/plan.ts` | `toTariff()` (new, private); `toTollPlaza()` now calls it instead of hardcoding `undefined`. |
| `src/routes/admin-toll-plazas-status.ts` | Response gains `bySource`. |
| `tests/helpers/fakes.ts` | `DUTRA_TOLL_PLAZA_RECORDS` gains `source: 'antt'`/`tariff: null`; new `OSM_TOLL_PLAZA_RECORD_WITH_TARIFF` fixture; `fakeTollPlazaStore`'s `status()` computes `bySource`. |
| `tests/plan.test.ts` | New `describe('OSM-sourced plazas carry a real tariff …')` — 3 tests (AC-5, AC-6, AC-7). |
| `tests/admin-toll-plazas-status.test.ts` | Existing 2 tests updated for `bySource`; 1 new test for a mixed antt/osm count. |
