# spec-kit — T5 Wave 2 (api): Pedágio real, Fase 1 (geo/identidade)

**Journey**: `j-20260916-9y` (T5)
**Unit**: `qualroteiro/api`, Wave 2 — depends on Wave 1 (`qualroteiro/root`,
`packages/tolls` + `services/data-ingest` scaffold) `merged`.
**Scope**: `apps/api` only. No `apps/web`, no `packages/**`, no
`services/data-ingest`, no `turbo.json`, `tsconfig.base.json`, root
`package.json` or `pnpm-workspace.yaml`.
**SDD route**: `aipe skill match --task-type feature --size medium` was run in
this workspace and returned `sdd=none — no SDD kit is installed`. This
artifact set follows the project's established spec-kit shape anyway —
`spec.md` → `plan.md` → a task doc — matching
`apps/api/specs/006-g1-google-places/`, per the coordinator's explicit
instruction (`orientation.md` §"### qualroteiro/api", acceptance list) to
replicate a prior real SDD's format regardless of the toolbox gap.

---

## Problem

The app has no real toll data — only three hand-seeded demo corridors
(`packages/tolls`'s in-package seed), explicitly marked DEMO DATA. Wave 1
already changed `matchTolls`'s signature so a caller passes its candidate
plaza list explicitly (`plazas: readonly TollPlaza[]`, no longer resolved
internally from `corridorHint`) and made `TollPlaza.tariffByAxleCategory`
optional. This unit is what actually exploits that seam on the production
path: a persisted table of real-world toll plazas (geography and identity —
ANTT's dataset, ingested by a later, separate unit), a store reading it, and
`POST /routes/plan` wired to that store instead of the demo seed.

**No tariff data exists yet, anywhere, for real plazas.** ANTT's own dataset
carries none — each concessionaire publishes its own fare table separately,
which is a distinct, fragmented, future phase (out of scope here). So this
unit's honest, documented trade is: real geographic coverage of toll plazas,
with `total` correctly counting `0` for every one of them until that future
phase exists — not a regression, a phase boundary.

## Users and their stories

**A traveller planning a route** sees every real toll plaza their route
passes (once Wave 3's ingestion job has populated the table), even before
prices are available for most of them — geography now, price later, rather
than neither.

**`services/data-ingest`'s future ingestion job** (Wave 3, not built here)
needs a table and a stable natural key to upsert into, so re-running a
monthly ingest updates existing rows instead of duplicating them.

**An operator** checks `GET /admin/toll-plazas-status` to see how many plazas
are stored and how recently they were ingested, without needing database
access — same operational-visibility precedent as G1's
`GET /admin/places-usage`.

## Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | A new Prisma model (`TollPlazaRecord`) persists `id` (stable natural key), `concessionaire`, `name`, `highway`, `uf`, `municipality`, `km`, `lat`, `lng`, `active`, `ingestedAt`. No tariff column. |
| AC-2 | A real migration is generated and applied against the local Postgres — not merely `prisma validate` — and a real round-trip (insert, read back, filter, clean up) is proven against the live database. |
| AC-3 | `TollPlazaStore` (port) + a Prisma adapter, same port/adapter shape as `ApiUsageStore`/`TripStore`. At minimum `listActive()`. |
| AC-4 | `POST /routes/plan` builds its `matchTolls` candidate list from the store (`listActive()`, mapped to `TollPlaza` with `tariffByAxleCategory: undefined`), replacing the Wave 1 bridge patch (`listCorridors().flatMap(...)`) on the production path. The in-package demo seed keeps existing — used only by `packages/tolls`'s own tests. |
| AC-5 | A store-mocked test with plazas (no tariff) proves `/routes/plan` includes them in `tolls.plazas` and does not break `tolls.total` (stays a real, finite `0`, not `NaN`/`undefined`/a thrown error). |
| AC-6 | An empty store (before any real ingestion has ever run) → `/routes/plan` still returns `200`, `tolls.plazas: []`, `tolls.total: 0` — no error. |
| AC-7 | `GET /admin/toll-plazas-status` → `200 { count: number, lastIngestedAt: string \| null }`, deliberately unauthenticated (same precedent as G1's `/admin/places-usage`), reflecting the real persisted count and the most recent `ingestedAt` across all rows. |
| AC-8 | The existing F1/F2a/G1 surface (`/places/search`, `/trips*`, `/places/nearby`, `/admin/places-usage`, `/health`) is unaffected (regression). |

## Out of scope

- **Tariff by axle category for real plazas (Fase 2)** — ANTT publishes no
  unified fare dataset; each concessionaire's own source is fragmented. A
  separate, future journey, if/when the PE approves it.
- **The Wave 3 ingestion job itself** (`services/data-ingest` downloading and
  parsing the real ANTT CSV, scheduling, upsert logic). This unit only
  builds what that job needs to write into — the model and the store's read
  side. Depends on this unit (`TollPlazaRecord` existing) being `merged`.
- **Real fuel station data** (`matchFuelStations` stays on the demo seed —
  `orientation.md` decision 1, deliberate).
- **Authentication on `GET /admin/toll-plazas-status`.**
- **Any UI change** for the "praça sem tarifa" case — that is `qualroteiro/web`
  Wave 2, a parallel, separately-dispatched unit.

## Deliberate limitations

- **`active` is not exercised meaningfully until Wave 3 runs.** The column
  and `listActive()`'s filter exist and are proven correct against a real
  database in this unit (see `tasks.md` "Verification"), but no process in
  this unit ever writes a row with `active: false` — that only happens once
  the real ANTT ingestion (Wave 3) sees a plaza whose `situacao` is not
  `'Ativo'`.
- **`GET /admin/toll-plazas-status`'s `count` counts every row, active or
  not** — deliberately different from `listActive()`'s filter, so an
  operator can see the whole table's size, not just what `/routes/plan`
  currently uses.
