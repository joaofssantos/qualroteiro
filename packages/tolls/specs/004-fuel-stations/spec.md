# T4 — Fuel Station Seed + Matcher

## Problem

`POST /routes/plan`'s `points.fuelStations` is always `[]` today because no
fuel-station data or matching function exists. This unit adds the data and a
`matchTolls`-style matcher in `@qualroteiro/tolls`; wiring it into the API
response is a separate unit in a different wave.

## Scope

**In:**
- `packages/tolls/src/types.ts` — add `FuelStationSeed` and an optional
  `Corridor.fuelStations` field (additive, so no existing corridor literal
  breaks).
- `packages/tolls/src/seed/{dutra,regis-bittencourt,bandeirantes}.ts` — seed
  4–6 demo fuel stations per corridor, each within `TOLL_MATCH_BUFFER_METERS`
  (500 m) of that corridor's `referencePolyline`, generic brand names, marked
  `DEMO DATA` matching the file's existing style.
- `packages/tolls/src/match.ts` — add `matchFuelStations`, same buffer-matching
  approach as `matchTolls` (`isWithinBuffer` from `@qualroteiro/geo`), results
  ordered by position along the route. Default buffer is
  `TOLL_MATCH_BUFFER_METERS` (no reason found to diverge from the toll-plaza
  buffer for this demo dataset).
- `packages/tolls/src/index.ts` — export `FuelStationSeed`, `matchFuelStations`,
  `MatchFuelStationsInput`, `MatchFuelStationsResult`.

**Out:**
- `apps/api`, `apps/web`, root config, `turbo.json`, `tsconfig.base.json`.
- Wiring `matchFuelStations` into `POST /routes/plan` (future unit).
- Any change to `matchTolls`, `TollPlaza`, or existing corridor plazas/tariffs.

## Acceptance

- `pnpm --filter @qualroteiro/tolls build`, `typecheck`, `test` all green.
- The existing 44 tolls tests keep passing unchanged in behavior.
- `matchFuelStations` over the Dutra `referencePolyline` returns exactly that
  corridor's seeded stations, all within the buffer.
- A synthetic polyline far from any corridor returns `{ stations: [] }`.
- Every seeded fuel station is within `TOLL_MATCH_BUFFER_METERS` of its own
  corridor's `referencePolyline` (self-consistency, mirrors the plaza check
  T3 proved).
- `git diff --name-only origin/dev..HEAD` touches only `packages/tolls/**`.
