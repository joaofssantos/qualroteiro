# sdd-lite - `apps/web` shared persistent map (G2, journey j-20260916-gl)

> `aipe skill match --task-type feature --size medium` returned `sdd=none` in
> this worktree (no SDD kit installed) — this doc replicates the `sdd-lite`
> shape of `specs/005-mapa-persistente/` and `specs/004-web-demo-mode/`
> (`spec.md` + `plan.md` + `evidence.md`) by hand, per the dispatch envelope's
> instruction to fall back to a real prior unit's format when the skill match
> is unreachable.

## Problem

`005-mapa-persistente` made the map survive navigation *within* "Rota &
Custos" (Tela 1 <-> Tela 2) by mounting a single `MapCanvas` in
`RotaCustosLayout`. It still unmounts — and its MapLibre/WebGL context is
destroyed — the moment the user navigates to a *different module*, because
`MapCanvas` lives inside that one module's own layout, not the shell.

This unit (G2) makes the map survive navigation *between modules*, and gives
any module (present or future) a way to publish its own markers to it without
the shell knowing what a toll plaza, a hotel or a restaurant is — the same
extensibility philosophy that already governs `moduleRegistry`.

## Scope

- `ModuleDefinition` (`core/registry/types.ts`) gains `showMap?: boolean`
  (default `false`) — a pure switch, no change to `mapLayers`'s existing shape.
- New store `core/map/mapStore.ts` (Zustand, same pattern as `routeStore.ts`):
  the generic channel any module publishes `layers` / `trace` /
  `onMarkerClick` to while mounted. Kept separate from `routeStore`, which
  stays the owner of rota-custos's own domain state (query/routes/plaza layer
  manager).
- `AppShell.tsx` renders `MapCanvas` once, reading from `mapStore`, in a
  persistent panel beside `children` — only when the module matching the
  active route has `showMap === true`. Every other module keeps today's
  full-width layout, unchanged.
- `RotaCustosLayout.tsx` stops mounting its own `MapCanvas`/split layout; it
  publishes the same computed layers/trace to `mapStore` instead, wires
  `onMarkerClick` through the store so a plaza click still opens
  `PlazaDrawer`, and clears the store on unmount. `rotaCustosModule` gets
  `showMap: true`.
- Extensibility proof: a module declared and registered entirely inside a
  test publishes real markers to the shared map, with no core file edited.

### Out of scope

- Turning `showMap` on for `hospedagem` / `restaurantes` / `atividades` /
  `planejamento-viagem` — each ships its own map wiring in G3/G4/G5 alongside
  the real search data it will show (see `.aipe/journeys/j-20260916-gl/
  orientation.md`).
- A visible layer-toggle/manager UI.
- Any change to `apps/api` or `packages/*`.

## Decision

`onMarkerClick` is a field on `mapStore`, not a prop threaded some other way:
`RotaCustosLayout` calls `setOnMarkerClick` with a closure that resolves the
clicked marker id against the *currently selected* route alternative and sets
its own local `selectedPlaza` state (which still drives `<PlazaDrawer>`,
rendered by `RotaCustosLayout` itself — `PlazaDrawer` did not need to move
anywhere, since it portals via `Sheet`/Radix and was never part of the map's
DOM layout). `AppShell` reads `onMarkerClick` from the store and passes it
straight through to `MapCanvas`, without knowing what it does.

The map container's `data-testid` moves from `rota-custos-map-container`
(previously owned by `RotaCustosLayout`) to `app-map-container` (now owned by
`AppShell`, the actual mount point, and no longer specific to one module) —
`rotaCustos.test.tsx` updated to match; the assertions' meaning (the same
container persists across Tela 1 -> Tela 2) is unchanged.

## Acceptance

- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` green.
- Zero regression in "Rota & Custos": `rotaCustos.test.tsx` still proves the
  active route's trace draws, toll/fuel-station markers appear, and clicking a
  toll marker opens `PlazaDrawer` — exactly as before.
- New test (`core/map/mapPersistence.test.tsx`): a `showMap: true` module
  registered only inside the test publishes markers via `mapStore` and
  `MapCanvas` draws them, without any core file edited to make it pass.
- A module without `showMap` renders no map panel and does not break layout;
  leaving a map module and returning does not resurrect a stale marker.
- Alternating between two `showMap: true` modules (rota-custos + the test's
  fake module) never mixes their markers.
- `core/registry/extensibility.test.tsx` passes unmodified.
- `git diff --name-only origin/dev..HEAD` touches only `apps/web/**`.
