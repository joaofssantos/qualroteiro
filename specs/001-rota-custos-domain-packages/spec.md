# Feature Specification: Rota & Custos — Domain Packages

**Feature Branch**: `aipe/j-20260908-yk/root--lane-pryce`
**Journey**: `j-20260908-yk`
**Unit**: `qualroteiro/root`
**Status**: Draft → Implemented
**Scope**: monorepo root config + four new workspace packages under `packages/`

---

## Context

qualroteiro's first module, **Rota & Custos (F1)**, takes an origin, a destination, optional
stops, a vehicle profile, a consumption figure and a fuel price, and returns — per route
alternative — distance, time, per-plaza toll cost, fuel cost, and a "points on route" panel.

This unit delivers **only the domain layer**: the pure, dependency-light packages that the
`api` unit will later compose behind HTTP endpoints. Nothing in this unit talks to a network,
a database, or a routing vendor.

**Non-goals of this unit**: any concrete routing/geocoding provider adapter, any HTTP
endpoint, any persistence, any UI, any infrastructure change.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fuel cost for a leg (Priority: P1)

As the `api` unit, I hand a distance, a vehicle's consumption and a fuel price to
`@qualroteiro/fuel` and get back the litres burned and the money spent, so I can put a
`fuelCost` on each route alternative.

**Acceptance Scenarios**

1. **Given** `distanceKm=430`, `consumptionKmPerL=10`, `pricePerL=6`,
   **When** `estimateFuel` is called,
   **Then** it returns `liters ≈ 43` and `cost ≈ 258` (tolerance `1e-6`).
2. **Given** a consumption of `0` or a negative consumption,
   **When** `estimateFuel` is called,
   **Then** it rejects the input rather than returning `Infinity` or a negative cost.

### User Story 2 - Toll plazas along a route (Priority: P1)

As the `api` unit, I hand a route geometry and an axle category to `@qualroteiro/tolls` and
get back the toll plazas that route actually passes, in order, with the total tariff, so I can
render the per-plaza breakdown and the "points on route" panel.

**Acceptance Scenarios**

1. **Given** the seed reference polyline for the **SP–RJ (Presidente Dutra)** corridor and
   axle category `car`,
   **When** `matchTolls` is called,
   **Then** it returns the plazas of that corridor, each with a tariff `> 0`, ordered along
   the route, and `total` equal to the sum of those tariffs.
2. **Given** a synthetic polyline that passes no seeded plaza,
   **When** `matchTolls` is called,
   **Then** it returns `{ plazas: [], total: 0 }`.
3. **Given** a plaza just inside the documented buffer and one just outside it,
   **When** the route is matched,
   **Then** only the inside plaza is selected.

### User Story 3 - A routing provider can be swapped (Priority: P2)

As the `api` unit, I implement `RoutingProvider` against a managed vendor today and against a
self-hosted Valhalla later, **without changing `@qualroteiro/routing`**.

**Acceptance Scenarios**

1. **Given** an in-memory fake that implements `RoutingProvider`,
   **When** it is used in place of a real provider,
   **Then** it type-checks and satisfies every consumer of the interface.
2. **Given** the built output of `@qualroteiro/routing` and `@qualroteiro/geo`,
   **When** `dist/` is grepped for `fetch(`, `undici`, `axios`, `node-fetch`,
   **Then** there are no matches — these packages carry no HTTP client.

### Edge Cases

- Zero-length or single-point route geometry passed to the geometry helpers.
- A plaza that has no tariff for the requested axle category.
- `matchTolls` called with a `corridorHint` that does not exist.
- Non-finite (`NaN`, `Infinity`) numeric inputs to `estimateFuel`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workspace MUST contain four private packages — `@qualroteiro/geo`,
  `@qualroteiro/routing`, `@qualroteiro/tolls`, `@qualroteiro/fuel` — each `"type": "module"`,
  each with a `tsconfig.json` extending `tsconfig.base.json`, each in the turbo build graph.
- **FR-002**: Each package MUST contain **only types and pure functions**. No network I/O, no
  HTTP client, no database access, in `src/`.
- **FR-003**: `@qualroteiro/fuel` MUST expose
  `estimateFuel({ distanceKm, consumptionKmPerL, pricePerL }) => { liters, cost }` and MUST
  reject non-positive or non-finite consumption.
- **FR-004**: `@qualroteiro/geo` MUST expose the types `LngLat`, `Place`, `LineString` and the
  `GeocodeProvider` interface, with **no implementation of `GeocodeProvider` in `src/`**.
- **FR-005**: `@qualroteiro/geo` MUST expose tested pure geometry helpers:
  `nearestPointOnLine`, `isWithinBuffer`, `kmMarker`.
- **FR-006**: `@qualroteiro/routing` MUST expose the `RoutingProvider` interface plus
  `RouteRequest`, `RouteResult`, `RouteAlternative`, and MUST contain **no provider
  implementation in `src/`**. A fake implementation MAY exist in test files only.
- **FR-007**: `@qualroteiro/tolls` MUST expose the types `TollPlaza`, `AxleCategory`,
  `Corridor` and the function `matchTolls({ routeGeometry, axleCategory, corridorHint? })`.
- **FR-008**: Plaza-to-route matching MUST be geometric: a plaza belongs to a route when its
  point lies within a **documented buffer constant** of the route polyline.
- **FR-009**: `@qualroteiro/tolls` MUST ship a versioned in-package seed dataset for three
  corridors — SP–RJ (Rod. Presidente Dutra, BR-116), SP–Curitiba (Rod. Régis Bittencourt,
  BR-116 sul), SP–Campinas (Rod. dos Bandeirantes, SP-348) — each with its plazas
  (name, concessionaire, highway, km, lat, lng, tariff by axle category) and a reference
  polyline exposed through a helper.
- **FR-010**: `@qualroteiro/tolls` MAY depend on `@qualroteiro/geo`. `@qualroteiro/geo` and
  `@qualroteiro/routing` MUST NOT depend on `@qualroteiro/tolls` or `@qualroteiro/fuel`.
- **FR-011**: The seed's approximate, demo-grade nature MUST be documented in the package
  README and in this SDD.

### Key Entities

- **LngLat** — a WGS-84 position, `{ lng, lat }`.
- **LineString** — GeoJSON `LineString`, `coordinates` as `[lng, lat]` pairs.
- **Place** — a geocoding result: `id`, `label`, `lng`, `lat`, optional `kind`.
- **RouteAlternative** — one option: `geometry` (GeoJSON `LineString`), `distanceKm`, `durationMin`.
- **AxleCategory** — the tariff class of a vehicle (motorcycle, car, trucks by axle count).
- **TollPlaza** — a physical plaza with a tariff table keyed by `AxleCategory`.
- **Corridor** — a named highway stretch: its plazas plus a reference polyline.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pnpm install`, then `pnpm -w build`, `pnpm -w typecheck` and `pnpm -w test` are
  green with all four packages in the graph, and `apps/api` / `apps/web` still build and
  typecheck unchanged.
- **SC-002**: `estimateFuel(430, 10, 6)` is proven by an automated test to yield
  `liters ≈ 43`, `cost ≈ 258` within `1e-6`.
- **SC-003**: `matchTolls` is proven by automated tests for both the Dutra-corridor case and
  the no-plaza case.
- **SC-004**: A geometry helper is proven by automated tests with an inside-the-buffer case
  **and** an outside-the-buffer case.
- **SC-005**: `grep` over `packages/{geo,routing}/dist` for `fetch(`, `undici`, `axios`,
  `node-fetch` returns nothing.

---

## Assumptions

- **A-001**: The toll seed is **demo data**. Plaza names, concessionaires, coordinates,
  kilometre markers and tariffs approximate the 2024–2025 real world but are **not** an
  authoritative source and are not fit for billing. Superseding it with a real ANTT/ARTESP
  feed is out of scope for this unit.
- **A-002**: `km` on a plaza is measured **along its corridor from the corridor's origin**
  (São Paulo for all three seeded corridors), not the highway's official DNIT kilometrage.
  This is internally consistent and is what the "points on route" panel needs.
- **A-003**: Corridor reference polylines are coarse demo approximations — a handful of
  vertices, not a survey-grade trace. They exist so `matchTolls` and its tests have a route to
  work against before a real provider is wired in.
- **A-004**: Anonymous usage, no auth, per the parent orientation spec — nothing in these
  packages models a user.
- **A-005**: `pnpm -w install` (as literally written in the acceptance brief) installs the
  **root importer only** — pnpm's `-w` means `--workspace-root`. A full workspace install
  requires plain `pnpm install`. See the plan's Risks section.
