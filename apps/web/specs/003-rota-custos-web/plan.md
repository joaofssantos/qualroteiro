# Implementation Plan: Rota & Custos — Web

**Spec**: `./spec.md` · **Unit**: `qualroteiro/web` · **Branch**: `aipe/j-20260908-yk/web--peggy-olson`

---

## 1. Technical context

| | |
|---|---|
| Language | TypeScript 5.6, `strict` + `noUncheckedIndexedAccess` (inherited from `tsconfig.base.json`) |
| UI | React 18, Vite 5 |
| Routing | `react-router-dom` v6 — routes generated from the module registry |
| State | **Zustand** (see §3 for why, over context+reducer) |
| Map | MapLibre GL 4, driven imperatively behind a `MapCanvas` wrapper |
| Styling | TailwindCSS 3 + shadcn/ui primitives, own palette |
| Test | Vitest + React Testing Library + jsdom; `fetch` and `maplibre-gl` mocked |
| Lint | ESLint 9 flat config, added as an `apps/web` devDependency |

**Consumed, not reimplemented**: `@qualroteiro/geo` (`Place`, `LineString`, `LngLat`),
`@qualroteiro/tolls` (`TollPlaza`, `AxleCategory`, `AXLE_CATEGORIES`). Both are added to
`apps/web`'s `dependencies` as `workspace:*`, which also makes turbo build them before web
(`build` → `dependsOn: ["^build"]`), since they are consumed from `dist`.

---

## 2. The dependency rule

```
        src/modules/rota-custos/**          (and every future module)
                    │  imports
                    ▼
        src/core/**   ── registry · store · api client · MapCanvas · layer manager · UI kit
                    ▲
                    │  NEVER imports upward
```

`src/modules/index.ts` is the **only** file that names concrete modules: a single array. The
shell reads the registry; it never names a module. This is enforced by a test that scans
`src/core/**` for any `modules/` import (AR-001) — a lint rule would be evadable by a
`// eslint-disable`, a test that reads the source is not.

---

## 3. Decision log

| Decision | Alternative rejected | Why |
|---|---|---|
| **Zustand** for the route store | React context + reducer | The store is read by the map (imperative, outside React's render path) and by several sibling panels. Zustand's `getState()`/subscribe gives the map an escape hatch without a provider dance, and selector subscriptions avoid re-rendering the whole result screen when only the active-alternative index changes. Context+reducer would re-render every consumer on each change. |
| Module registry as a **mutable array + `registerModule()`** | A static frozen array | The extensibility test must register a fake module *without editing a core file*. A mutable registry with an idempotent `registerModule` makes that possible from inside the test, and is what a plugin story needs anyway. Production registration still happens in exactly one place. |
| Markers as **MapLibre `Marker` DOM elements**, not a symbol layer | GeoJSON symbol layer + `setLayoutProperty` | Markers are real DOM nodes, so a click handler is plain React-adjacent DOM and the toggle is provable in jsdom against a mocked maplibre. A symbol layer would need a WebGL context to prove anything. |
| Submit `{lng,lat}` when a hit was picked, raw string otherwise | Always geocode client-side first | The contract accepts both, and letting the server geocode free text is what produces the `422` we are required to handle. |
| Own `src/env.d.ts` instead of `types: ["vite/client"]` | Add `src/vite-env.d.ts` with a triple-slash reference | A triple-slash `/// <reference types="vite/client" />` fails identically when `vite` is unresolvable. Declaring `ImportMetaEnv` ourselves removes the resolution dependency entirely *and* types this app's actual env vars. |

---

## 4. Structure

```
apps/web/
  .env.example                        VITE_API_BASE_URL, VITE_MAP_STYLE_URL
  eslint.config.js                    flat config (new)
  vite.config.ts                      react plugin, /api dev proxy, vitest config
  src/
    env.d.ts                          ImportMetaEnv — the vite/client fix
    main.tsx                          registers modules, mounts <App/>
    App.tsx                           <BrowserRouter> + routes from the registry
    lib/                              cn(), currency/number/duration formatters
    components/ui/                    shadcn primitives: button, input, label, tabs,
                                      sheet, card, select, badge, separator
    core/
      registry/                       ModuleDefinition, registerModule, listModules
      api/                            types.ts (contract), client.ts, errors.ts (ApiError)
      store/routeStore.ts             query · response · activeIndex · layer visibility
      map/MapCanvas.tsx               MapLibre wrapper: route trace + marker layers
      map/layers.ts                   MapLayer types + toggle helpers
      shell/AppShell.tsx              sidebar nav generated from the registry
      components/PlaceSearch.tsx      debounced autocomplete → Place
      components/VehicleProfileForm.tsx
    modules/
      index.ts                        THE ARRAY — one entry per module
      rota-custos/
        index.tsx                     the ModuleDefinition
        NewQueryScreen.tsx            Tela 1
        ResultScreen.tsx              Tela 2 (split layout)
        panels/{Summary,Tolls,Fuel,Points,Alternatives}.tsx
        PlazaDrawer.tsx               Tela 3
  src/**/__tests__/                   colocated Vitest suites
```

---

## 5. Sequence (TDD — RED before GREEN at each step)

1. **Tooling** — add deps; fix `env.d.ts` + `tsconfig`; add ESLint flat config; add Vitest
   config + jsdom setup + a `maplibre-gl` mock. *Gate*: `typecheck` and `lint` run at all.
2. **Fetch layer** — `RED`: a test asserting `planRoute()` posts to `/api/routes/plan` and maps
   `422` to a field-attributed `ApiError`. `GREEN`: `client.ts` + `errors.ts`.
3. **Registry + shell** — `RED`: the extensibility test (fake `demo` module → nav entry +
   `/demo` renders) and the AR-001 source-scan test. `GREEN`: registry, `AppShell`, `App`.
4. **Primitives** — `RED`: `PlaceSearch` debounce/select test; `MapCanvas` route + layer-toggle
   test against the mocked maplibre. `GREEN`: both, plus `VehicleProfileForm` and the store.
5. **Module screens** — `RED`: the full flow test (Tela 1 submit → Tela 2 summary + Pedágios +
   Combustível), the alternatives-delta test, the drawer test, the `422`-vs-`400` test.
   `GREEN`: the three screens and their panels.
6. **Verify** — `/verify-before-done`: `pnpm install && pnpm -w build && pnpm --filter
   @qualroteiro/web typecheck && lint && test`, plus a real `vite build` and a dev-server render.

---

## 6. Assumed API contract *(stated explicitly, per the working method)*

Read from `apps/api/specs/002-rota-custos-api/spec.md` **and verified against the handler
source** (`apps/api/src/routes/plan.ts`, `places.ts`, `app.ts`, `errors.ts`):

- `POST /routes/plan` → `200 { routes: PlannedRoute[] }`; `routes` may be **empty** (the spec
  says so explicitly) — the UI must handle "nenhuma rota encontrada".
- `422` body is `{ error: "<field>: no place found for '<query>'" }` — produced by
  `UnresolvedPlaceError`, whose message is `` `${field}: no place found for '${query}'` `` with
  `field` ∈ `origin` | `destination` | `waypoints[i]`. The client parses the field off the
  prefix before the first `:`. **If the API ever adds a structured `field` on the error body,
  the client should prefer it**; parsing is the fallback the current contract forces.
- All error bodies are `{ error: string }` uniformly across `400`/`422`/`502`.
- `TollPlaza` is returned verbatim, so `tariffByAxleCategory` is present and is the tariff
  source.
- `points.fuelStations` is typed `readonly never[]` server-side — always `[]`.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| MapLibre cannot run in jsdom (no WebGL) | `vi.mock('maplibre-gl')` with a fake `Map`/`Marker`; map behaviour is proven through the calls `MapCanvas` makes, and separately eyeballed in a real dev server. |
| Turbo caching a stale `packages/*/dist` | `apps/web` declares the packages as `workspace:*` deps so `^build` orders them; verified by a clean `pnpm -w build`. |
| shadcn CLI wants to rewrite root config | Primitives are vendored by hand into `src/components/ui/` — no CLI, no root writes. |
