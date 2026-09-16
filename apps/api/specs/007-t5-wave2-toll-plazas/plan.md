# Implementation Plan: T5 Wave 2 (api) — Pedágio real, Fase 1

**Spec**: [`spec.md`](./spec.md)
**Unit**: `qualroteiro/api` · **Journey**: `j-20260916-9y`

---

## Summary

One new Prisma model (`TollPlazaRecord`, geography/identity only, no
tariff), one new port + Prisma adapter (`TollPlazaStore`), one route wired to
it (`POST /routes/plan`, replacing the Wave 1 bridge patch), and one new
read-only admin endpoint (`GET /admin/toll-plazas-status`). Same
port/adapter shape as `ApiUsageStore`/`TripStore`; same "deliberately
unauthenticated operational endpoint" precedent as G1's
`admin-places-usage.ts`.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6+ (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) |
| Runtime | Node ≥ 20, ESM |
| HTTP | Fastify 5 (present) |
| Test runner | vitest 2.x + `app.inject()` — no port bound, no network |
| New runtime deps | **None.** |
| Persistence | Prisma 5.22 + PostgreSQL — one new model, one new migration, **applied against the real local Postgres** (`postgis/postgis:16-3.4`, `localhost:5433` — see the task doc's "Verification"). |

---

## Key Decisions

**D-701 — `TollPlazaRecord.id` is a natural key, not a surrogate
`@default(uuid())`.** ANTT's dataset has no numeric id of its own (confirmed
by the coordinator's own inspection of the real CSV — see `orientation.md`).
A surrogate id would let Wave 3's monthly re-ingestion insert a duplicate row
for the same physical plaza every month instead of upserting onto it. The
suggested shape (documented in `prisma/schema.prisma`'s doc-comment, exact
slugging left to Wave 3 to decide and document when it writes the first row):
a slug of concessionaire + plaza name + highway + km — every one of those
four fields is present in ANTT's own CSV columns
(`concessionaria;praca_de_pedagio;rodovia;km_m`), so the key is derivable
from the source data with no external lookup.

**D-702 — no tariff column on `TollPlazaRecord`, at all.** Not nullable, not
optional — simply absent. `spec.md`'s "Out of scope": ANTT's dataset itself
has no fare column, and a nullable column here would invite a later unit to
half-fill it inconsistently before the real per-concessionaire scraping
phase is actually designed. `toTollPlaza()` (`routes/plan.ts`) maps every
record to `tariffByAxleCategory: undefined` unconditionally — there is no
code path in this unit that could produce anything else.

**D-703 — `TollPlazaStore` is a port with a Prisma adapter and an in-memory
fake — same shape as `TripStore` (F2a D-505) and `ApiUsageStore` (G1
D-604).** What makes AC-5/AC-6 (plazas without tariff don't break the total;
an empty table doesn't error) provable without touching Postgres: the fake
(`tests/helpers/fakes.ts`'s `fakeTollPlazaStore`) is a real implementation of
the port's filtering (`listActive()` actually filters on `active`) and
aggregation (`status()` actually computes `count`/`lastIngestedAt` from
whatever was seeded), not a stub returning fixtures.

**D-704 — `tollPlazas` is a REQUIRED `AppDeps` field, unlike G1's
`googlePlaces`/`apiUsage`/`placesMonthlyCap` optional triple or F2a's
`auth`/`trips` optional pair.** `/routes/plan` is F1's always-on surface —
there is no configuration where an app should serve routes without a toll
answer (even an empty one), the way there legitimately is a configuration
that serves F1 without `/trips*` (`orientation.md`'s Wave 1 note explicitly
frames this as F1 "no longer fully stateless": `DATABASE_URL` is read on
every `/routes/plan` request now). Making it required, not an optional pair
to half-wire, means `buildApp` cannot construct a broken configuration here
the way it actively guards against for the other two.

**D-705 — the plaza candidate list is fetched once per request, not once
per route alternative.** `registerPlanRoute`'s handler calls
`deps.tollPlazas.listActive()` a single time and passes the mapped list into
every `planOne(alt, req, candidates)` call — every alternative is matched
against the same candidates, and a provider returning `N` alternatives costs
one store read, not `N`.

**D-706 — `GET /admin/toll-plazas-status`'s `count` is every row (active or
not), while `/routes/plan` only ever reads `listActive()`.** Deliberately
different queries for deliberately different questions: the admin endpoint
answers "how much has been ingested, total", `/routes/plan` answers "what's
currently usable". Same reasoning as G1's `sku`-keyed usage rows answering a
different question than the breaker's own read.

**D-707 — `GET /admin/toll-plazas-status` is deliberately unauthenticated,
same precedent as G1's `admin-places-usage.ts` (D-607).** Operational data
(a count and a timestamp), not user data.

---

## Data model

```
TollPlazaRecord  id (natural key, @id)
```

| Model | Notes |
|---|---|
| `TollPlazaRecord` | `id String @id` — no `@default`, the caller (Wave 3's ingestion job, or this unit's verification script) supplies a stable natural key. `active Boolean` with `@@index([active])` — `listActive()`'s own filter. No tariff column (D-702). |

---

## Implementation order (TDD, RED → GREEN per step)

1. `prisma/schema.prisma` — `TollPlazaRecord` model; `prisma validate` green.
2. Real migration: `prisma migrate diff --from-schema-datasource … --to-schema-datamodel …
   --script` (non-interactive equivalent of `migrate dev`, since this session
   is non-interactive), written into a new `prisma/migrations/<timestamp>_…/`
   folder by hand, then `prisma migrate deploy` against the real local
   Postgres.
3. `src/store/toll-plaza-store.ts` (port: `TollPlazaRecord`, `TollPlazaStatus`,
   `TollPlazaStore`) + `src/store/prisma-toll-plaza-store.ts` (Prisma
   adapter) + `tests/helpers/fakes.ts`'s in-memory `fakeTollPlazaStore` and
   `DUTRA_TOLL_PLAZA_RECORDS` fixture.
4. `src/routes/plan.ts` — `toTollPlaza()` mapper, `PlanRouteDeps.tollPlazas`
   (required), `planOne()` takes the candidate list as a parameter instead of
   resolving it itself; the route handler fetches it once per request. This
   replaces the Wave 1 bridge patch
   (`// TODO(Wave 2 — j-20260916-9y): substituir por lista vinda do banco real`).
5. `src/routes/admin-toll-plazas-status.ts` (AC-7).
6. `src/app.ts` — `AppDeps.tollPlazas` (required), route registration,
   existing test call sites updated (every `buildApp(...)` in the test suite
   now passes `tollPlazas`).
7. `src/server.ts` wiring (`createPrismaTollPlazaStore(prisma)`).
8. `apps/api/tests/plan.test.ts` — rewritten "plans SP→RJ" test (plazas
   matched, `total` now `0` — the documented Wave 2 behaviour change, not a
   bug) + new `describe('toll plazas from the store …')` block (AC-5, AC-6,
   plus an inactive-row exclusion test).
9. `apps/api/tests/admin-toll-plazas-status.test.ts` (AC-7, new file).
10. Real round-trip against the live database (temporary script under
    `apps/api/.tmp-verify/`, deleted after running — see the task doc).
