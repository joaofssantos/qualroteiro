# Evidence — shared persistent map (G2, journey j-20260916-gl)

## Environment note (read before trusting any path in this doc)

The dispatch instructions named a worktree at
`repos/qualroteiro/.worktrees/j-20260916-gl-web--peggy-olson` on branch
`aipe/j-20260916-gl/web--peggy-olson`. The sandbox instead isolated this
session into its own worktree,
`repos/qualroteiro/.claude/worktrees/agent-aeea31b16643283e9`, and its git
tool actively refuses any `git -C <other-worktree>` command — the exact
failure mode the dispatch note warned had happened to another dev on this
journey before. That branch name was also already checked out in the named
worktree, so it could not be checked out a second time here.

All work in this doc happened on branch
`aipe/j-20260916-gl/web--peggy-olson--sandbox`, created from the same commit
(`ebe063f`, confirmed identical to `origin/dev` — empty diff, no partial work
to recover) inside this sandbox's own worktree. **The coordinator needs to
either fetch this branch and fast-forward/rename it onto
`aipe/j-20260916-gl/web--peggy-olson`, or push it and merge from there** —
this was not silently committed to a different place without saying so.

## `/verify-before-done`

Run from `apps/web/` inside
`repos/qualroteiro/.claude/worktrees/agent-aeea31b16643283e9`.

```
$ pnpm -w build
 Tasks:    7 successful, 7 total
Cached:    6 cached, 7 total
  Time:    6.347s

$ pnpm --filter @qualroteiro/web typecheck
> tsc --noEmit                              # no output -> clean

$ pnpm --filter @qualroteiro/web lint
> eslint src                                # no output -> clean

$ pnpm --filter @qualroteiro/web test
 ✓ src/core/api/client.test.ts                          (8)
 ✓ src/core/api/trips.test.ts                            (10)
 ✓ src/core/api/demo/handlers.test.ts                    (10)
 ✓ src/modules/planejamento-viagem/TripDetailScreen.test.tsx (11)
 ✓ src/core/components/PlaceSearch.test.tsx               (5)
 ✓ src/core/map/MapCanvas.test.tsx                        (8)
 ✓ src/core/registry/architecture.test.ts                 (4)
 ✓ src/core/map/mapPersistence.test.tsx                   (3)   NEW
 ✓ src/core/registry/extensibility.test.tsx                (6)   unmodified
 ✓ src/modules/atividades/SaveActivityToTripDialog.test.tsx (2)
 ✓ src/modules/restaurantes/SaveRestaurantToTripDialog.test.tsx (2)
 ✓ src/modules/rota-custos/SaveRouteToTripDialog.test.tsx  (2)
 ✓ src/modules/hospedagem/SaveStayToTripDialog.test.tsx    (2)
 ✓ src/modules/restaurantes/calc.test.ts                   (4)
 ✓ src/modules/hospedagem/calc.test.ts                     (3)
 ✓ src/core/api/demo/demoMode.test.tsx                     (7)
 ✓ src/modules/restaurantes/restaurantes.test.tsx           (1)
 ✓ src/modules/atividades/atividades.test.tsx               (2)
 ✓ src/modules/hospedagem/hospedagem.test.tsx               (1)
 ✓ src/modules/atividades/calc.test.ts                      (3)
 ✓ src/core/auth/AuthProvider.test.tsx                      (1)
 ✓ src/modules/rota-custos/rotaCustos.test.tsx             (17)   unchanged assertions, testid updated
 Test Files  22 passed (22)
      Tests  112 passed (112)
```

## Zero-regression proof for "Rota & Custos" — not just "the test passes"

`rotaCustos.test.tsx` runs unchanged **behaviorally** — the only edit is the
`data-testid` the map container queries (see spec's Decision) — and every one
of the following, previously-passing assertions still holds after the
refactor moved `MapCanvas` from `RotaCustosLayout` to `AppShell`:

| Behavior (observable, same before/after) | Proven by |
|---|---|
| Map region visible on Tela 1 before any submit | `shows selected origin and destination markers before submitting` |
| Origin/destination markers drawn from `PlaceSearch` picks, no `/routes/plan` call yet | same test |
| Map container is the *same DOM node* across Tela 1 -> Tela 2 (`constructedMaps` stays length 1 — MapLibre is not torn down and recreated) | `keeps the same map container when the result screen opens` |
| Active route's trace geometry drawn on the map | `draws the route trace on the map` |
| Toll markers + tariff label appear on the map | `lists every plaza with its tariff...` (map assertions) + `Pontos na rota` describe block |
| Switching the active alternative updates both the summary numbers and the map trace | `Alternativas > selecting the second alternative changes the trace and every summary number` |
| Toggling the toll layer removes/restores its markers on the map | `Pontos na rota — layer toggling > toggling the toll layer removes and restores its markers` |
| Clicking a toll marker **on the map** opens `PlazaDrawer` with that plaza's data | `Tela 3 — detalhe da praça > opens the same drawer when the plaza marker on the map is clicked` |
| Clicking a toll row **in the list** opens the same drawer | `Tela 3 — detalhe da praça > opens a drawer with the plaza data when a plaza is clicked in the list` |

The map-click -> `PlazaDrawer` path is the one most at risk from moving
`MapCanvas` out of `RotaCustosLayout`'s own render tree: it now round-trips
through `mapStore.onMarkerClick`, set by `RotaCustosLayout`'s effect and read
by `AppShell` to hand to `MapCanvas`, instead of being an inline prop one
component down. The two "detalhe da praça" tests above are unchanged text and
still pass, which is the concrete proof that round-trip works identically to
before.

## Acceptance mapping (full list, `orientation.md` + this unit's `spec.md`)

| Acceptance | Proven by |
|---|---|
| build/typecheck/lint/test green | `/verify-before-done` above |
| `showMap?: boolean` on `ModuleDefinition`, default off, no shape change to `mapLayers` | `core/registry/types.ts`; every module but `rota-custos` still renders full-width (see next row) |
| Zero regression in Rota & Custos | table above |
| New module (fake, registered only inside the test) publishes markers via the store, `MapCanvas` draws them, no core file edited | `mapPersistence.test.tsx` › `lets a showMap:true module publish real markers...` |
| Module without `showMap` gets no map panel, no leaked marker, no broken layout | `mapPersistence.test.tsx` › `renders no map panel for a module without showMap...` |
| Two `showMap:true` modules (rota-custos + the fake one) never mix markers | `mapPersistence.test.tsx` › `does not mix markers between two showMap:true modules...` |
| `extensibility.test.tsx` passes unmodified | file untouched in this diff; still green above |
| `git diff --name-only origin/dev..HEAD` only `apps/web/**` | see next section |
| SDD: `aipe skill match --task-type feature --size medium` | returned `sdd=none` in this worktree — documented at the top of `spec.md`; this `sdd-lite` doc set (`spec.md`/`plan.md`/`evidence.md`) replicates `specs/005-mapa-persistente/`'s shape by hand |

## Diff scope

```
$ git diff --name-only ebe063f..HEAD
apps/web/specs/007-mapa-persistente-compartilhado/evidence.md
apps/web/specs/007-mapa-persistente-compartilhado/plan.md
apps/web/specs/007-mapa-persistente-compartilhado/spec.md
apps/web/src/core/map/mapPersistence.test.tsx
apps/web/src/core/map/mapStore.ts
apps/web/src/core/registry/types.ts
apps/web/src/core/shell/AppShell.tsx
apps/web/src/modules/rota-custos/RotaCustosLayout.tsx
apps/web/src/modules/rota-custos/index.tsx
apps/web/src/modules/rota-custos/rotaCustos.test.tsx
apps/web/src/test/renderApp.tsx
```

All under `apps/web/**`. `ebe063f` is the commit `origin/dev` was at when
this branch was cut (confirmed identical — empty `git diff`).

## `/state-the-limit`

- No real browser run — proof is vitest + jsdom + the existing MapLibre stub
  (`src/test/maplibre-stub.ts`), same harness every other map test in this
  repo already relies on, plus a real production `vite build`.
- `showMap` is not turned on for `hospedagem`/`restaurantes`/`atividades`/
  `planejamento-viagem` — by design, out of scope for this unit (see
  `orientation.md`'s scoping note). Those modules render exactly as they did
  before this change; nothing about them was touched or tested differently.
- No visible layer-toggle/manager UI was built — not asked for.
- The map container's `data-testid` changed owner
  (`rota-custos-map-container` -> `app-map-container`); anything outside this
  diff querying that old id (none found in this repo) would need updating.
