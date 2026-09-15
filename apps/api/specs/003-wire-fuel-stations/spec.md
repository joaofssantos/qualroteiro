# T4 — Wire Fuel Stations

## Problem

`POST /routes/plan`'s `points.fuelStations` is hardcoded `readonly never[]` /
always `[]`. `@qualroteiro/tolls` now exports `matchFuelStations` (mirrors
`matchTolls`, already wired) plus seeded fuel stations per corridor. This unit
wires the real matcher in, alongside the existing `matchTolls` call.

## Scope

**In:**
- `apps/api/src/routes/plan.ts` — change `PlannedRoute['points']['fuelStations']`
  from `readonly never[]` to `readonly FuelStation[]` (imported and aliased
  from `@qualroteiro/tolls`'s `FuelStationSeed`, which already matches the
  `{id, name, lng, lat}` shape `apps/web` expects). Call `matchFuelStations`
  per route alternative alongside `matchTolls`, same `routeGeometry`; no
  `corridorHint` is passed, mirroring the existing `matchTolls` call which
  doesn't pass one either.
- `apps/api/tests/plan.test.ts` — assert `points.fuelStations` is non-empty
  and shaped `{id,name,lng,lat}` for the SP→RJ (Dutra) fixture, and `[]` for a
  route matching no seeded corridor.
- `apps/api/specs/002-rota-custos-api/spec.md` — update the "Deliberate
  limitations" line that says `fuelStations` is always `[]`.

**Out:**
- `apps/web`, `packages/*`, root config, `turbo.json`, `tsconfig.base.json`.
- Any change to `matchTolls`, `matchFuelStations`, or the seed data itself.

## Acceptance

- `pnpm --filter @qualroteiro/api test`, `typecheck`, `lint` all green.
- `POST /routes/plan` for SP→RJ (Dutra reference geometry, provider mocked)
  → `points.fuelStations` is non-empty, each item `{id,name,lng,lat}`.
- A route whose geometry matches no seeded corridor → `points.fuelStations:
  []`, no error.
- `git diff --name-only origin/dev..HEAD` touches only `apps/api/**`.
