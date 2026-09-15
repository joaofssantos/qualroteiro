# Feature Specification: Rota & Custos — Web (app shell, module registry, F1 module)

**Feature Branch**: `aipe/j-20260908-yk/web--peggy-olson`
**Journey**: `j-20260908-yk`
**Unit**: `qualroteiro/web`
**Status**: Draft → Implemented
**Scope**: `apps/web` only. No `apps/api`, no root config (`turbo.json`, `tsconfig.base.json`,
root `package.json`, `pnpm-workspace.yaml`), no `packages/**`.

---

## Context

qualroteiro's first module is **Rota & Custos (F1)**: origin, destination, optional stops, a
vehicle profile, a consumption figure and a fuel price in — distance, time, per-plaza toll cost,
fuel cost and a "points on route" panel out.

WAVE 1 delivered the pure domain packages (`@qualroteiro/{geo,routing,tolls,fuel}`). WAVE 2
delivered the HTTP API (`apps/api`, contract versioned in
`apps/api/specs/002-rota-custos-api/spec.md`). This unit (WAVE 3) delivers the **user-facing
application**, and — more importantly than the module itself — the **skeleton that later
modules plug into without touching the core**.

The strategic requirement is extensibility. "Rota & Custos" is the first of several planned
modules (planejamento de viagem, roteiro, frete). If adding the second module requires editing
the shell, the map, the store or the layer manager, this unit has failed regardless of how good
F1 looks.

**Non-goals**: authentication (F1 is anonymous), persistence of any kind, server-side rendering,
i18n machinery (the product is pt-BR only for now), fuel-station data, offline support, and any
change to the API contract.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan a route and read its costs (Priority: P1)

As an anonymous user, I type an origin and a destination, describe my vehicle, and get a map of
the route beside a panel that tells me what the trip costs.

**Acceptance Scenarios**

1. **Given** the "Nova consulta" screen, **When** I set origin `São Paulo, SP`, destination
   `Rio de Janeiro, RJ`, a vehicle profile and a fuel price, and submit, **Then** the app calls
   `POST /routes/plan` once and shows the result screen.
2. **Given** a result with one alternative (`distanceKm 429.7`, `tolls.total 52.9`, ≥1 plaza,
   `fuel.cost = distanceKm / 10 * 6`), **Then** the map draws the route trace, the summary row
   shows distance, duration, toll total and fuel total, the **Pedágios** tab lists each plaza
   with its tariff for the selected axle category, and the **Combustível** tab shows litres,
   price and cost.
3. **Given** a result with two alternatives, **When** I select the second in **Alternativas**,
   **Then** the trace drawn on the map and every number in the summary change to that
   alternative's.

### User Story 2 - Inspect a toll plaza (Priority: P1)

As a user looking at a route, I click a plaza — on the map or in the Pedágios list — and a
drawer shows me who operates it, which highway it is on, at which kilometre, and what it costs
for each axle category.

### User Story 3 - Find a place without knowing its exact spelling (Priority: P1)

As a user typing into an origin/destination box, I see matching places as I type and pick one.
Typing does not fire a request per keystroke.

**Acceptance Scenarios**

1. **Given** the origin field, **When** I type `São Pau`, **Then** after the debounce window a
   single `GET /places/search?q=São Pau` is issued, and the hits are offered.
2. **When** I pick a hit, **Then** the field shows that place's label and the query carries its
   coordinates.

### User Story 4 - Understand what went wrong (Priority: P1)

As a user who typed an address nobody can find, I am told *which* field is the problem and that
the address is the issue — not handed a generic "invalid form".

**Acceptance Scenarios**

1. **Given** `POST /routes/plan` responds `422 { error: "destination: no place found for '...'" }`,
   **Then** the destination field shows an "endereço não encontrado" message and the form is not
   marked generically invalid.
2. **Given** it responds `400 { error: "..." }`, **Then** the generic/field validation path is
   used instead.

### User Story 5 - Add the second module (Priority: P1 — the point of the wave)

As a developer adding "Frete" six weeks from now, I write one module file and add one entry to
one array. The nav gains an entry and the route renders my panel. I edit no core file.

**Acceptance Scenario**

1. **Given** a module `{ id:'demo', label:'Demo', path:'/demo', Panel }` declared entirely
   outside `src/core/**`, **When** it is registered, **Then** the shell nav shows "Demo" and
   navigating to `/demo` renders the panel — with no edit to the shell, map, store or layer
   manager.

### User Story 6 - See the points along the route (Priority: P2)

As a user, I toggle the layers drawn on the map. Toggling **Pedágios** adds or removes the plaza
markers. The **Postos** section exists but is empty in F1 and says so.

---

## Architecture Requirements *(the extensibility contract)*

- **AR-001 — Dependency direction.** `src/core/**` MUST NOT import from `src/modules/**`. Modules
  import the core; the core never imports a concrete module. This is asserted by an automated
  test that reads the core's source, not by convention alone.
- **AR-002 — Registry.** A module declares
  `{ id, label, icon?, path, Panel, mapLayers? }` and is registered by adding it to a single
  array (`src/modules/index.ts`). The shell's navigation and its routes are **derived** from the
  registry at render time — neither contains a hard-coded module entry.
- **AR-003 — Shared primitives.** `MapCanvas`, `PlaceSearch`, `VehicleProfileForm`, the route
  store and the layer manager live in the core and are reusable by a future module unchanged.
- **AR-004 — Fetch seam.** All network access goes through one typed client
  (`src/core/api/client.ts`). Tests mock `fetch`, never a component's internals.

---

## Functional Requirements *(mandatory)*

- **FR-001** — The app MUST consume the WAVE 2 contract exactly as specified: `POST /routes/plan`
  and `GET /places/search?q=`. It MUST NOT require any change to `apps/api`.
- **FR-002** — Origin, destination and each stop MUST be submitted as `{ lng, lat }` when the user
  picked a geocoded hit, and as a raw string when they typed free text without picking — both are
  valid per the contract.
- **FR-003** — `400`, `422` and `502` MUST be distinguished. `422` MUST be attributed to the
  named field (`origin`, `destination`, `waypoints[i]`) parsed out of the error message, and MUST
  read as "address not found", not "form invalid".
- **FR-004** — `points.fuelStations` is always `[]` in F1. The UI MUST render the section with an
  explicit empty state ("sem dados de postos nesta fase") rather than hiding it.
- **FR-005** — Toll tariffs MUST be read from `TollPlaza.tariffByAxleCategory` for the axle
  category the user selected. The web app MUST NOT recompute tariffs — `@qualroteiro/tolls`
  owns that.
- **FR-006** — View models MUST import domain types from `@qualroteiro/{geo,tolls}` rather than
  redeclaring `Place`, `TollPlaza` or `AxleCategory`.
- **FR-007** — `PlaceSearch` MUST debounce (≥250 ms) and MUST abort a superseded in-flight
  request.
- **FR-008** — The map style URL MUST come from `VITE_MAP_STYLE_URL` with a working default, and
  the API base from `VITE_API_BASE_URL` with a dev proxy from `/api` to the API. Both MUST be
  documented in `apps/web/.env.example`.
- **FR-009** — The result screen MUST be a split layout: map left, cost panel right, at ≥768 px.
- **FR-010** — `pnpm --filter @qualroteiro/web {build,typecheck,lint,test}` and the monorepo
  `pnpm -w build` MUST all pass.

---

## Defect: `vite/client` typecheck/build failure *(pre-existing, in scope)*

**Observed** — from a state where `apps/web`'s own dependencies are not installed (a
workspace-root-only install, a filtered or pruned CI install, or a fresh checkout where only root
deps were installed), `tsc` in `apps/web` fails:

```
error TS2688: Cannot find type definition file for 'vite/client'.
  The file is in the program because:
    Entry point of type library 'vite/client' specified in compilerOptions
```

**Root cause** — `apps/web/tsconfig.json` declares `"types": ["vite/client"]`. An entry in
`compilerOptions.types` is a *hard* entry-point type library: if it cannot be resolved, TypeScript
raises a fatal configuration error, whether or not any source file uses `import.meta.env`. The
project's type-check therefore depends on a runtime package being physically resolvable from
`apps/web`, which makes it fragile against every partial-install topology.

**Fix (inside `apps/web`)** — stop referencing `vite/client` as an entry-point type library and
declare the ambient surface the app actually uses in `src/env.d.ts`: a typed `ImportMetaEnv` that
names exactly this app's `VITE_*` variables, plus `ImportMeta.env`. `compilerOptions.types` is set
to `[]` so no ambient `@types` package is auto-included either. This makes the type-check
self-contained, and as a side effect the app's env vars become typed and discoverable instead of
`string | undefined` from a vendor declaration. Root config is not touched.

**Second, related defect** — `apps/web`'s `lint` script (`eslint src`) has never been runnable:
`eslint` is not a dependency of `apps/web` nor of the workspace root (`sh: eslint: command not
found`). This unit adds ESLint as an `apps/web` devDependency with a flat config. `apps/api` has
the identical latent breakage; fixing it is out of this unit's scope and is reported upward.

---

## Key Entities

- **ModuleDefinition** — `{ id, label, icon?, path, Panel, mapLayers? }`; the whole surface a
  module exposes to the shell.
- **PlanQuery** — what the user asked: origin, destination, stops, vehicle profile, fuel price.
- **PlannedRoute** — one alternative and its costs, exactly as the API returns it.
- **MapLayer** — `{ id, label, visible, markers }`; the unit the layer manager toggles.

---

## Deliberate limitations *(carried into `/state-the-limit`)*

- No live API and no live tile server is contacted by any test; the fetch layer and MapLibre are
  both mocked. Correctness against the *real* ORS-backed API is unproven by this unit.
- Below 768 px the split layout stacks and degrades; it is not a designed mobile experience.
- `points.fuelStations` is empty by contract, so its rendering is only proven against an empty
  array.
- Toll figures inherit the WAVE 1 seed's DEMO status; a route outside the three seeded corridors
  legitimately shows `R$ 0,00` in tolls.
