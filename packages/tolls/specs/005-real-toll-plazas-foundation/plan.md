# Plan

1. `types.ts`: mark `TollPlaza.tariffByAxleCategory` optional. One-line
   change, ripples into every consumer that indexes it without a null check.
2. `match.ts`: replace `corridorHint?: CorridorId` with a required
   `plazas: readonly TollPlaza[]` on `MatchTollsInput`; drop the
   `listCorridors()`/`getCorridor()` candidate resolution inside
   `matchTolls` (loop directly over the passed-in `plazas`); change the
   total accumulation to `plaza.tariffByAxleCategory?.[axleCategory] ?? 0`.
   Leave `matchFuelStations` and its `MatchFuelStationsInput.corridorHint`
   untouched — different function, different phase.
3. `tests/match.test.ts`: thread `plazas: allPlazas` (`listCorridors()
   .flatMap(c => c.plazas)`) through every existing case; replace the old
   `corridorHint` describe block with an equivalent "explicit plazas
   parameter" block proving the caller's list, not an internal corridor
   hint, drives the restriction; add a new describe block for a plaza with
   no `tariffByAxleCategory` (appears in `plazas[]`, contributes `0`).
4. `tests/seed.test.ts`: the two assertions that indexed
   `plaza.tariffByAxleCategory[category]`/`.motorcycle` directly now need a
   `toBeDefined()` guard (or a non-null assertion after one) since the type
   is `T | undefined` — the demo seed data itself does not change, only the
   type narrowing the tests have to satisfy.
5. Build `@qualroteiro/geo` first (an unbuilt workspace dependency's `dist`
   is what makes `tsc` fail with `Cannot find module '@qualroteiro/geo'`
   when running a package's scripts directly instead of through turbo's
   `^build` dependency graph), then run `@qualroteiro/tolls`
   `typecheck`/`lint`/`test`.
6. Scaffold `services/data-ingest`: copy `packages/tolls/package.json`'s
   shape (dropping the `@qualroteiro/geo` dependency — nothing to depend on
   yet), `tsconfig.json`/`tsconfig.test.json` identical in structure to
   `packages/tolls`', a placeholder `src/index.ts` exporting `ping()`, and a
   one-assertion smoke test. Confirm `pnpm install` links it as a workspace
   member (via `pnpm-workspace.yaml`'s existing `services/*` glob) and that
   `turbo run build/typecheck/test --filter=@qualroteiro/data-ingest` picks
   it up with zero `turbo.json` changes (it did — no config edits needed).
7. Run `pnpm -w build` twice: once through turbo's cache (misleading —
   turbo's own cache-bypass doesn't invalidate `apps/web`'s local
   `tsc -b` incremental `.tsbuildinfo`, nor does it necessarily finish
   independent tasks after a sibling fails without `--continue`) and once
   with `apps/web/tsconfig.tsbuildinfo` deleted plus `turbo run build
   --continue`, to get the true, complete list of downstream breakage in
   both `apps/api` and `apps/web`. Document exact file:line findings in the
   spec's "Downstream breakage" section instead of fixing them (out of
   scope for this unit).

## Notes for the coordinator / Wave 2 dispatch

- `apps/web`'s breakage is *not* limited to what the orientation doc's
  cross-package-contracts section anticipated (UI rendering of an
  `undefined` tariff). `apps/web/src/core/api/demo/fixtures.ts` calls
  `matchTolls` directly with the old `corridorHint` shape — Wave 2 web's
  dev needs to fix that call site too, not only the panel/drawer rendering.
