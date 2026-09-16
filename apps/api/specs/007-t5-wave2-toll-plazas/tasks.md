# Task doc — T5 Wave 2 (api): Pedágio real, Fase 1

Filled in as the work landed. What changed, how it was verified, and the
environment notes worth flagging.

## What changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | New `TollPlazaRecord` model — `id` (natural key, no `@default`), `concessionaire`, `name`, `highway`, `uf`, `municipality`, `km`, `lat`, `lng`, `active`, `ingestedAt`, `@@index([active])`. No tariff column. |
| `prisma/migrations/20260916070000_t5_wave2_toll_plaza_record/migration.sql` | The DDL for the new table + its index — **applied for real** against the local Postgres (see Verification). |
| `src/store/toll-plaza-store.ts` | `TollPlazaRecord`, `TollPlazaStatus`, `TollPlazaStore` (port) — `listActive()`, `status()`. |
| `src/store/prisma-toll-plaza-store.ts` | The Prisma adapter — both methods read-only. |
| `src/routes/plan.ts` | Removes the Wave 1 bridge patch (`listCorridors().flatMap(...)`); adds `toTollPlaza()` mapper (`tariffByAxleCategory: undefined`, always); `PlanRouteDeps.tollPlazas` (required); `planOne()` takes the candidate list as a parameter; the route handler fetches `listActive()` once per request, not once per alternative. |
| `src/routes/admin-toll-plazas-status.ts` | `GET /admin/toll-plazas-status` — deliberately unauthenticated (see `spec.md`). |
| `src/app.ts` | `AppDeps.tollPlazas` (required, unlike the optional pairs/triples for F2a/G1); registers `admin-toll-plazas-status` unconditionally; `registerPlanRoute` now receives `tollPlazas`. |
| `src/server.ts` | Wires `createPrismaTollPlazaStore(prisma)` into `buildApp`. |
| `.env.example` | Notes `DATABASE_URL` is now required for F1's `/routes/plan` too (previously documented as fully stateless). |
| `tests/helpers/fakes.ts` | `fakeTollPlazaStore` (real in-memory port semantics) + `DUTRA_TOLL_PLAZA_RECORDS` fixture. |
| `tests/plan.test.ts` | Rewrites the SP→RJ test for the Wave 2 behaviour change (plazas matched, `total` now `0`); new `describe('toll plazas from the store ...')` block; every `buildApp(...)` call site updated. |
| `tests/admin-toll-plazas-status.test.ts` | New — 4 tests. |
| `tests/places.test.ts`, `tests/places-nearby.test.ts`, `tests/trips.test.ts` | `buildApp(...)` call sites updated for the new required `tollPlazas` dep. |

## Environment notes

**Worktree redirect, same shape as G1's.** This session's sandbox placed the
work in its own isolated git worktree
(`.claude/worktrees/agent-a51bb8098851166ee`, working branch
`work/j-20260916-9y-api-pete-campbell`) rather than the
`.worktrees/j-20260916-9y-api--pete-campbell` path named in the brief — the
harness's own worktree isolation refused git operations redirected there
(`git -C <that path>` was explicitly rejected), and that branch name was
already checked out in that other, inaccessible worktree. This worktree's
starting point was content-identical to `origin/main` (`git diff --name-only
origin/main..HEAD` was empty before this unit's commits), so nothing about
the branch history differs from "reset on top of `origin/main`" — only the
on-disk path and the exact branch name do. At the end of this session, this
branch is pushed to `origin/aipe/j-20260916-9y/api--pete-campbell` (the
intended name) via `git push origin HEAD:refs/heads/aipe/j-20260916-9y/api--pete-campbell`,
per the brief's own documented fallback for this exact situation.

**`.env` was NOT copied from the other worktree** — unlike G1, it was
unreachable this session (the same isolation that blocked git operations
blocks plain file reads there too). A fresh `apps/api/.env` was written by
hand in this worktree, pointing `DATABASE_URL` at the same local Postgres
every other unit in this session used
(`postgresql://qualroteiro:qualroteiro@localhost:5433/qualroteiro?schema=public`
— confirmed reachable and already carrying F2a's/G1's tables via `docker exec
qualroteiro-postgres-1 psql ... '\dt'` before writing anything), with
placeholder values for `ORS_API_KEY`/`CLERK_SECRET_KEY`/`GOOGLE_PLACES_API_KEY`
(none of this unit's work exercises those — no real external call was made
or needed). No secret value was fabricated as if real; the placeholders are
plainly labelled `local-dev-placeholder-not-used-by-tests`.

## Verification

Run from this worktree's `apps/api`, all green:

```
pnpm --filter @qualroteiro/api typecheck   # tsc -p tsconfig.test.json — clean
pnpm --filter @qualroteiro/api lint        # eslint src — clean
pnpm --filter @qualroteiro/api test        # 159 passed (8 files) — 7 net-new tests (3 in plan.test.ts's new "toll plazas from the store" block, 4 in the new admin-toll-plazas-status.test.ts); 152 pre-existing tests still pass, several rewritten in place (the SP→RJ test, the off-corridor test) rather than counted as new
pnpm -w build                              # turbo run build — 8/8 tasks succeeded
```

### Real Postgres — schema, migration, and round-trip

The local Postgres (`postgis/postgis:16-3.4`, `localhost:5433`) was reachable
this session — same container every other unit in this session used,
confirmed to already carry `Trip`/`TripDay`/`TripItem`/`ApiUsageCounter`
before this unit touched it.

This session is non-interactive, so `prisma migrate dev` (which requires a
TTY) was not usable. The non-interactive equivalent was used instead:

```
$ pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma --script
-- CreateTable
CREATE TABLE "TollPlazaRecord" ( ... );
-- CreateIndex
CREATE INDEX "TollPlazaRecord_active_idx" ON "TollPlazaRecord"("active");
```

That output was written by hand into a new
`prisma/migrations/20260916070000_t5_wave2_toll_plaza_record/migration.sql`
(following the existing `<timestamp>_<name>` folder convention), then applied
for real:

```
$ pnpm exec prisma migrate deploy
Datasource "db": PostgreSQL database "qualroteiro", schema "public" at "localhost:5433"
3 migrations found in prisma/migrations
Applying migration `20260916070000_t5_wave2_toll_plaza_record`
All migrations have been successfully applied.

$ pnpm exec prisma migrate status
Database schema is up to date!

$ pnpm exec prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

A real round-trip against the live database, through
`createPrismaTollPlazaStore` (temporary script,
`apps/api/.tmp-verify/toll-plaza-roundtrip.mjs`, deleted after running — using
a throwaway `verify-*` id, cleaned up at the end):

```
status before: { count: 0, lastIngestedAt: null }
status after insert: { count: 1, lastIngestedAt: 2026-09-16T17:44:05.373Z }
listActive() includes the inserted row: true
round-tripped row: {
  id: 'verify-ccr-riosp-aruja-br-116-km-32',
  concessionaire: 'CCR RioSP',
  name: 'Arujá (verify)',
  highway: 'BR-116',
  uf: 'SP',
  municipality: 'Arujá',
  km: 32,
  lat: -23.3967,
  lng: -46.3208,
  active: true,
  ingestedAt: 2026-09-16T17:44:05.373Z
}
after marking inactive, listActive() excludes it: true
status after deactivate (count unchanged, row still counted): { count: 1, lastIngestedAt: 2026-09-16T17:44:05.373Z }
status after cleanup: { count: 0, lastIngestedAt: null }
```

This proves, against the real database, not a mock: the insert round-trips
through Prisma's generated client correctly typed as `TollPlazaRecord`;
`listActive()` really filters on `active` (the row disappears the instant it
is marked `false`, while `status().count` — deliberately every row —
correctly still counts it); `status()` aggregates a real `count` and a real
`lastIngestedAt` from the live table, both `0`/`null` again once the row is
deleted.

### Empty-table behaviour — proven at the route level, not just the store level

`apps/api/tests/plan.test.ts`'s `'works with no error and zero tolls when the
table is empty (before Wave 3 ever ran)'` test builds a real `buildApp` with
`tollPlazas: fakeTollPlazaStore()` (no records) and asserts `POST
/routes/plan` returns `200`, `tolls.plazas: []`, `tolls.total: 0`,
`points.tolls: []` — the full route handler, not a unit test of the store in
isolation.

### Behaviour change was checked for being the RIGHT change, not just a passing test

The old `'plans SP→RJ with tolls and fuel costs'` test asserted `route.tolls.
total` was `> 0` — true under the Wave 1 bridge patch (demo-seed plazas, all
carrying a tariff), now false by design once the production path reads the
real store instead (T5 Wave 2's real plazas carry no tariff — see `spec.md`
"Problem"). The rewritten test asserts `total === 0` explicitly and asserts
every matched plaza's `tariffByAxleCategory` is `undefined`, rather than
loosening the assertion to something that would silently pass either way —
so a future regression that accidentally re-introduces a tariff-bearing
default would fail this test.

## Design decisions within scope

- **Natural key slugging is intentionally UNSPECIFIED here.** `spec.md`/
  `plan.md` (D-701) document the suggested shape (concessionaire + plaza name
  + highway + km) but this unit never writes a row from real ANTT data — only
  the verification script's one throwaway row, whose id
  (`verify-ccr-riosp-aruja-br-116-km-32`) was chosen by hand, not through a
  slugging function. Wave 3's ingestion job is where an actual slugger (exact
  casing, separator, accent-stripping) gets written and tested against real
  CSV rows — inventing one here, untested against the real dataset's messy
  values, would be guessing.
- **`toTollPlaza()` lives in `routes/plan.ts`, not in the store module.**
  It's a view concern specific to what `matchTolls` needs (`@qualroteiro/
  tolls`'s `TollPlaza` shape), not a property of the persisted record itself
  — the store's job ends at handing back `TollPlazaRecord[]`.
- **The candidate list is fetched once per request (D-705)**, after the
  routing provider call succeeds and before mapping over its alternatives —
  same "fail fast, don't pay for work the request will discard" ordering the
  handler already used for geocoding before this unit touched it.
- **`GET /admin/toll-plazas-status`'s `count` deliberately counts every row,
  not just active ones (D-706)** — answers a different, broader question than
  `/routes/plan`'s own read.

## Not done, on purpose

The Wave 3 ingestion job (`services/data-ingest` downloading/parsing the real
ANTT CSV, scheduling, the real slugging function), per-concessionaire tariff
scraping (Fase 2), and any `apps/web` UI change for the "praça sem tarifa"
case — all out of scope per [`spec.md`](./spec.md) and owned by other,
separately-dispatched units. No file outside `apps/api/` was touched.
