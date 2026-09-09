# Tasks: Rota & Custos — Domain Packages

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md)

`[P]` = parallelisable with its siblings. Method is `/tdd`: every `T-*t` task writes a
**failing** test, the matching `T-*i` task makes it pass.

## Phase 1: Setup

- [x] **T-01** Scaffold `packages/{geo,routing,tolls,fuel}` — `package.json` (`@qualroteiro/<x>`,
      private, `"type": "module"`, `exports`/`types` → `dist`), `tsconfig.json`,
      `tsconfig.test.json`, `README.md`.
- [x] **T-02** Add `vitest` as a devDependency to each of the four packages; `test` script =
      `vitest run`, `build` = `tsc -p tsconfig.json`, `typecheck` = `tsc -p tsconfig.test.json`.
- [x] **T-03** Declare `@qualroteiro/geo": "workspace:*"` as a dependency of `tolls` only.
- [x] **T-04** `turbo.json`: give `test` an empty `outputs` so results are not miscached.
      Leave `pnpm-workspace.yaml`, `tsconfig.base.json`, root `package.json`, `.nvmrc` alone.
- [x] **T-05** Record the baseline: `pnpm install && pnpm -w build && pnpm -w typecheck` on the
      untouched tree, to prove any later failure is ours.

## Phase 2: `@qualroteiro/geo` (Foundational — `tolls` blocks on it)

- [x] **T-06t** RED: `tests/geometry.test.ts` — haversine against a known SP–RJ distance;
      `nearestPointOnLine` on a simple two-vertex line; `isWithinBuffer` **inside** case;
      `isWithinBuffer` **outside** case; `kmMarker` midpoint. (SC-004)
- [x] **T-07i** GREEN: `src/types.ts` (`LngLat`, `LineString`, `Place`, `GeocodeProvider` —
      interface only, no implementation) and `src/geometry.ts` (haversine, local
      equirectangular point-to-segment, `nearestPointOnLine`, `isWithinBuffer`, `kmMarker`,
      `lineLengthMeters`, `pointAtFraction`). Guard degenerate lines.

## Phase 3: `@qualroteiro/fuel` [P]

- [x] **T-08t** RED: `tests/estimate.test.ts` — the acceptance vector
      `(430, 10, 6) → liters ≈ 43, cost ≈ 258` at tolerance `1e-6`; zero consumption rejected;
      negative consumption rejected; `NaN`/`Infinity` rejected; zero distance → zero cost. (SC-002)
- [x] **T-09i** GREEN: `src/estimate.ts` — `estimateFuel`, `RangeError` on bad input,
      rounding per D-006.

## Phase 4: `@qualroteiro/routing` [P]

- [x] **T-10t** RED: `tests/contract.test.ts` — an in-memory fake `RoutingProvider`
      (**test file only**, never `src/`) returning two alternatives; assert the shape.
- [x] **T-11i** GREEN: `src/types.ts` — `RoutingProvider`, `RouteRequest`, `RouteResult`,
      `RouteAlternative`; geometry typed as GeoJSON `LineString` per D-002.

## Phase 5: `@qualroteiro/tolls` (depends on Phase 2)

- [x] **T-12t** RED: `tests/seed.test.ts` — three corridors present; every plaza has a
      `car` tariff `> 0`, finite coords, a concessionaire; every plaza lies within the buffer
      of its own corridor's reference polyline (the seed is self-consistent).
- [x] **T-13t** RED: `tests/match.test.ts` — Dutra reference polyline + `car` returns exactly
      the Dutra plazas, ordered along the route, `total` = sum of their `car` tariffs;
      a synthetic far-away polyline returns `{ plazas: [], total: 0 }`;
      `corridorHint` narrows the candidate set; unknown `corridorHint` throws. (SC-003)
- [x] **T-14i** GREEN: `src/types.ts` (`AxleCategory`, `TollPlaza`, `Corridor`),
      `src/tariff.ts` (`tariffTable`, multiplier ladder per D-005),
      `src/seed/*.ts` (Dutra / Régis Bittencourt / Bandeirantes + reference polylines),
      `src/match.ts` (`matchTolls`, `TOLL_MATCH_BUFFER_METERS`, `getCorridor`,
      `listCorridors`, `corridorPolyline`).

## Phase 6: Verify & Deliver

- [x] **T-15** `/verify-before-done`: `pnpm install`, `pnpm -w build`, `pnpm -w typecheck`,
      `pnpm -w test` from the worktree root; capture exact output.
- [x] **T-16** SC-005: grep `packages/geo/dist` and `packages/routing/dist` for `fetch(`,
      `undici`, `axios`, `node-fetch`; show it clean.
- [x] **T-17** Confirm `apps/api` + `apps/web` still build and typecheck (not edited).
- [x] **T-18** `/state-the-limit`, commit, push, open PR → `dev`.

## Dependencies

```
T-01 → T-02 → T-03/T-04 → T-05
T-05 → Phase 2 → Phase 5
T-05 → Phase 3 [P]
T-05 → Phase 4 [P]
Phases 2–5 → Phase 6
```

Phases 3 and 4 are independent of Phase 2 and of each other. Phase 5 blocks on Phase 2 for the
geometry helpers.
