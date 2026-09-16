# T5 — Real Toll Plazas, Wave 1 (foundation)

> SDD written by hand: `aipe skill match --task-type feature --size medium`
> returned `sdd=none` (no SDD kit installed in this fresh worktree). This
> file follows the format of `specs/003-road-polylines` and
> `specs/004-fuel-stations` to keep the package's SDD trail consistent.
> Full architectural reasoning lives in
> `.aipe/journeys/j-20260916-9y/orientation.md` (outside this package) —
> this spec is the package-scoped summary of Wave 1 only.

## Problem

The app has no real toll-plaza data — only three hand-seeded demo corridors,
explicitly marked "DEMO DATA". This journey (`j-20260916-9y`) replaces that
with real ingestion from the ANTT's official dataset (277 active plazas, 36
concessionaires, 12 states), in three waves. **This spec covers Wave 1
only**: the foundation that lets later waves plug real data in without
reshaping `packages/tolls`' public API again.

Real-world ANTT plazas are loose points — they do not belong to the demo
package's curated, closed `Corridor`/`CorridorId` union, and the ANTT
dataset has no single source for tariff-by-axle (each concessionaire
publishes its own, separately — out of scope, a future Phase 2). Two
consequences drive this spec:

1. `matchTolls` must accept its candidate plaza list from the caller instead
   of resolving it internally from the demo seed — a real caller assembles
   its list from a database, not from `listCorridors()`.
2. `TollPlaza.tariffByAxleCategory` must become optional — a real plaza
   ingested in Wave 3 has identity and location but not yet a fare.

## Scope

**In:**
- `packages/tolls/src/types.ts` — `TollPlaza.tariffByAxleCategory` becomes
  `?: TariffByAxleCategory` (was required). No other field changes.
- `packages/tolls/src/match.ts` — `matchTolls`'s `corridorHint?: CorridorId`
  parameter is replaced by a required `plazas: readonly TollPlaza[]`
  parameter. `matchTolls` no longer calls `listCorridors()`/`getCorridor()`
  internally; the caller assembles the candidate list. The `total` sum
  treats a matched plaza with `tariffByAxleCategory === undefined` as
  contributing `0`, but that plaza still appears in the result's `plazas[]`.
- `packages/tolls/tests/match.test.ts` — updated to pass `plazas` explicitly
  (e.g. `listCorridors().flatMap(c => c.plazas)` for cases that previously
  relied on the implicit "every corridor" default); new tests for the
  no-tariff-plaza behavior.
- `packages/tolls/tests/seed.test.ts` — assertions adjusted for
  `tariffByAxleCategory` now being optional on the type (the demo seed
  itself is unchanged: every seeded plaza still carries a tariff).
- `services/data-ingest/**` (new package) — scaffold only:
  `package.json`, `tsconfig.json`, `tsconfig.test.json`, a placeholder
  `src/index.ts` (`ping()`), a smoke test. No ingestion logic — that is
  Wave 3, gated on `apps/api`'s `TollPlazaRecord` Prisma model (Wave 2)
  existing, since `services/data-ingest` will generate its Prisma Client
  against `apps/api/prisma/schema.prisma` rather than define its own schema.

**Out (deliberate):**
- `matchFuelStations` — unchanged. Fuel stations stay resolved via
  `corridorHint`/`listCorridors()` internally; this phase is toll-only. The
  asymmetry between `matchTolls` and `matchFuelStations` is intentional, to
  be revisited if/when fuel stations get real ingestion.
- `apps/api`, `apps/web` — not touched. `apps/api`'s `plan.ts` call to
  `matchTolls` (missing the new required `plazas`) and `apps/web`'s two call
  sites that reference the old shape (`src/core/api/demo/fixtures.ts`'s
  direct `matchTolls({ ..., corridorHint })` call, and every read of
  `plaza.tariffByAxleCategory.<category>` without a null check) are expected
  to fail `build`/`typecheck` until their own Wave 2 units land. See
  "Downstream breakage" below.
- Any ingestion logic, HTTP wiring, or Prisma model — future waves.
- Root config (`turbo.json`, `pnpm-workspace.yaml`) — `services/*` was
  already in the pnpm workspace glob and turbo's task globs are
  package-agnostic, so `services/data-ingest` picked up `build`/
  `typecheck`/`lint`/`test` automatically with zero root config changes.

## Downstream breakage (expected, not fixed here)

A full `pnpm -w build` (clean cache) after this change fails in exactly two
packages, both out of this unit's scope:

- `apps/api` — `src/routes/plan.ts:80`, `matchTolls({ routeGeometry,
  axleCategory })` is missing the new required `plazas`. One call site.
- `apps/web` — `tsc -b` surfaces 7 errors:
  - `src/core/api/demo/fixtures.ts:176` — its own direct `matchTolls({ ...,
    corridorHint: spec.corridorId })` call: `corridorHint` no longer exists
    on `MatchTollsInput`, and `plazas` is missing. **This call site is not
    behind `apps/api`** — `apps/web`'s demo fixtures call `@qualroteiro/tolls`
    directly, so Wave 2 web's dev must also update this call (pass
    `plazas: getCorridor(spec.corridorId).plazas` or similar), not only the
    UI fallback rendering the orientation spec's cross-package-contracts
    section called out.
  - Six more from `tariffByAxleCategory` narrowing to `T | undefined`:
    `src/core/api/demo/demoMode.test.tsx:100`,
    `src/core/api/demo/handlers.test.ts:101`,
    `src/modules/rota-custos/panels/TollsPanel.tsx:52`,
    `src/modules/rota-custos/PlazaDrawer.tsx:113`,
    `src/modules/rota-custos/rotaCustos.test.tsx:207`,
    `src/modules/rota-custos/RotaCustosLayout.tsx:67`.

## Acceptance

- `pnpm --filter @qualroteiro/tolls typecheck`, `lint`, `test` all green.
- Test: `matchTolls` given a plaza with no `tariffByAxleCategory` — the
  plaza appears in `plazas[]`, does not count toward `total`.
- Test: `matchTolls` given the explicit plaza list for a demo corridor
  reproduces the prior implicit-corridor-hint behavior exactly (Dutra total
  still `52.9`; zero regression).
- `pnpm --filter services/data-ingest build`, `typecheck`, `lint`, `test`
  all green (scaffold-trivial).
- `pnpm -w build` fails in exactly `@qualroteiro/api` and `@qualroteiro/web`
  (documented above), and nowhere else.
- `git diff --name-only origin/main..HEAD` touches only `packages/tolls/**`,
  `services/data-ingest/**`, and `pnpm-lock.yaml` (new workspace package
  registration — unavoidable, no `turbo.json`/`pnpm-workspace.yaml` edits
  needed).
