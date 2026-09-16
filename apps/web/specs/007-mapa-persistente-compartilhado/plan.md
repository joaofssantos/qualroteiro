# Plan - shared persistent map

1. Add `showMap?: boolean` to `ModuleDefinition` (`core/registry/types.ts`).
2. Add `core/map/mapStore.ts` — Zustand store exposing `layers`, `trace`,
   `onMarkerClick`, and `setMapLayers` / `setMapTrace` / `setOnMarkerClick` /
   `clearMap`.
3. `AppShell.tsx`: match the active route against `listModules()` by
   `module.path`; when the matched module has `showMap === true`, render the
   same split layout `RotaCustosLayout` used to own (`h-[38vh]` mobile /
   `flex-1` desktop) with `MapCanvas` reading `mapStore`, beside `children`.
4. `RotaCustosLayout.tsx`: replace the owned `MapCanvas`/split-layout markup
   with effects that publish the same computed `mapLayers`/`trace` to
   `mapStore`, wire `onMarkerClick` to keep opening `PlazaDrawer`, and clear
   the store on unmount. Add `showMap: true` to `rotaCustosModule`.
5. Update `rotaCustos.test.tsx`'s one reference to the map container's
   `data-testid` (`rota-custos-map-container` -> `app-map-container`, now
   owned by `AppShell`) and `test/renderApp.tsx`'s `resetApp()` to also clear
   `mapStore` between tests.
6. New test `core/map/mapPersistence.test.tsx`: a module declared and
   registered inside the test proves publish/draw, no-leak-across-modules,
   and no-mixing-between-two-map-modules — the extensibility and
   cleanup-contract proof.
7. Run `build` / `typecheck` / `lint` / `test`; write `evidence.md`.
