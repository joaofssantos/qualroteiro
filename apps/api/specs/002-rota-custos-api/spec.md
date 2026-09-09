# Feature Specification: Rota & Custos — HTTP API

**Feature Branch**: `aipe/j-20260908-yk/api--pete-campbell`
**Journey**: `j-20260908-yk`
**Unit**: `qualroteiro/api`
**Status**: Draft → Implemented
**Scope**: `apps/api` only — provider adapters + two HTTP endpoints. No root config, no `apps/web`.

---

## Context

qualroteiro's first module, **Rota & Custos (F1)**, takes an origin, a destination, optional
stops, a vehicle profile, a consumption figure and a fuel price, and returns — per route
alternative — distance, time, per-plaza toll cost, fuel cost, and a "points on route" panel.

WAVE 1 delivered the pure domain layer (`@qualroteiro/{geo,routing,tolls,fuel}`): types,
interfaces and pure functions, with **no** provider implementation and **no** HTTP surface.

This unit (WAVE 2) delivers the composition layer: the **concrete adapters** that satisfy
WAVE 1's `RoutingProvider` and `GeocodeProvider` interfaces, and the **HTTP endpoints** that
WAVE 3 (`apps/web`) will consume.

**Non-goals of this unit**: any persistence (F1 is anonymous and stateless), any migration,
any Valhalla/Photon self-hosted path, any UI, any infrastructure change, any toll-data
ingestion.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan a route with costs (Priority: P1)

As an anonymous user, I give an origin, a destination, my vehicle profile, my consumption and
my fuel price, and I get back one or more route alternatives, each with its distance, time,
toll cost broken down per plaza, fuel cost, and the points it passes.

**Acceptance Scenarios**

1. **Given** `origin: "São Paulo, SP"`, `destination: "Rio de Janeiro, RJ"`,
   `vehicle: { type: "car", axleCategory: "car", consumptionKmPerL: 10 }`, `fuelPricePerL: 6`,
   and a routing provider returning a plausible SP→RJ alternative,
   **When** `POST /routes/plan` is called,
   **Then** it responds `200` with `routes.length >= 1`, `routes[0].distanceKm` in `400..470`,
   `routes[0].tolls.total > 0`, `routes[0].tolls.plazas` non-empty, and
   `routes[0].fuel.cost` equal to `distanceKm / 10 * 6` within `±0.01` (the cent-rounding
   tolerance `@qualroteiro/fuel` applies).
2. **Given** coordinates supplied directly as `{ lng, lat }` rather than strings,
   **When** `POST /routes/plan` is called,
   **Then** no geocoding occurs and the route is planned from those coordinates.
3. **Given** a body with no `destination`,
   **When** `POST /routes/plan` is called,
   **Then** it responds `400` and the message names `destination`.
4. **Given** a routing provider that throws or times out,
   **When** `POST /routes/plan` is called,
   **Then** it responds `502`.

### User Story 2 - Search for a place (Priority: P1)

As an anonymous user typing into an origin/destination box, I get a list of matching places
with coordinates, so the app can resolve what I typed.

**Acceptance Scenarios**

1. **Given** `q=São Paulo` and a geocoder returning hits,
   **When** `GET /places/search?q=São Paulo` is called,
   **Then** it responds `200` with a non-empty `places` array.
2. **Given** no `q` parameter (or an empty/blank one),
   **When** `GET /places/search` is called,
   **Then** it responds `400` and the message names `q`.

### User Story 3 - Liveness (Priority: P2)

`GET /health` continues to respond `200 { status: "ok" }`, and CORS stays registered because
`apps/web` is cross-origin.

---

## HTTP Contract *(versioned — WAVE 3 builds against this)*

### `POST /routes/plan`

**Request body**

```jsonc
{
  "origin":      { "lng": -46.6333, "lat": -23.5505 },  // or a string: "São Paulo, SP"
  "destination": "Rio de Janeiro, RJ",                   // or { lng, lat }
  "waypoints":   [],                                     // optional; same union, in visit order
  "vehicle": {
    "type": "car",                 // free-form label for the UI
    "axleCategory": "car",         // one of @qualroteiro/tolls AXLE_CATEGORIES
    "consumptionKmPerL": 10        // > 0
  },
  "fuelPricePerL": 6               // >= 0
}
```

**`200` response**

```jsonc
{
  "routes": [
    {
      "geometry":   { "type": "LineString", "coordinates": [[lng, lat], ...] },
      "distanceKm": 429.7,
      "durationMin": 342.5,
      "tolls":  { "plazas": [ /* TollPlaza[] from @qualroteiro/tolls */ ], "total": 38.7 },
      "fuel":   { "liters": 42.97, "cost": 257.82 },
      "points": {
        "tolls":        [ /* same TollPlaza[] */ ],
        "fuelStations": []
      }
    }
  ]
}
```

**Status codes**

| Code | When |
|---|---|
| `200` | at least zero alternatives planned successfully (`routes` may be empty if the provider returns none) |
| `400` | body missing/not an object, or any field missing/ill-typed/out of range; message names the offending field |
| `422` | a supplied place string could not be geocoded to any hit; message names which one |
| `502` | routing or geocoding provider failed, errored or timed out |

### `GET /places/search?q=<string>`

| Code | Body | When |
|---|---|---|
| `200` | `{ "places": Place[] }` | `q` present and non-blank (`places` may be empty) |
| `400` | `{ "error": "...q..." }` | `q` missing or blank |
| `502` | `{ "error": "..." }` | geocoding provider failed |

### `GET /health`

`200 { "status": "ok" }`.

**Error body shape**, uniform across `400`/`422`/`502`: `{ "error": "<human-readable message>" }`.

---

## Requirements *(mandatory)*

- **FR-001** — The API MUST implement `RoutingProvider` (WAVE 1) against **OpenRouteService**,
  reading base URL and API key from the environment, and MUST request alternative routes so
  `routes[]` can carry more than one option.
- **FR-002** — The API MUST implement `GeocodeProvider` (WAVE 1) against OpenRouteService's
  Pelias geocoder, using the same key, mapping results to `Place[]`.
- **FR-003** — Both providers MUST be **injectable**: route handlers receive them through a
  seam, and a test MUST be able to substitute a fake without editing handler code.
- **FR-004** — `origin`, `destination` and each `waypoints` item MUST accept either
  `{ lng, lat }` or a string; a string is geocoded and the top hit is used.
- **FR-005** — Per alternative the API MUST call `matchTolls` with the alternative's geometry
  and the requested axle category, and `estimateFuel` with the alternative's distance, the
  vehicle's consumption and the fuel price. It MUST NOT reimplement either.
- **FR-006** — Validation failures MUST return `400` with a message naming the bad field.
- **FR-007** — Provider failure or timeout MUST return `502`, never a `500` stack.
- **FR-008** — These endpoints and their tests MUST NOT require a live database, Redis,
  Valhalla or Photon.
- **FR-009** — `apps/api/.env.example` MUST document `ORS_API_KEY` and `ORS_BASE_URL` with
  placeholders, without altering the infra vars owned by `qualroteiro/root`.

---

## Key Entities

- **PlannedRoute** — one alternative plus its costs: `geometry`, `distanceKm`, `durationMin`,
  `tolls`, `fuel`, `points`.
- **Place** — a geocoding hit (`@qualroteiro/geo`): `id`, `label`, `lng`, `lat`, `kind?`.
- **TollPlaza** — a seeded plaza (`@qualroteiro/tolls`), returned verbatim; the API does not
  reshape it, so WAVE 3 reads `name`, `concessionaire`, `highway`, `km`, `lat`, `lng` directly.

---

## Deliberate limitations *(carried into `/state-the-limit`)*

- `points.fuelStations` is **always `[]`**. The WAVE 1 toll seed carries corridors and plazas
  only — it has no fuel-station data — and the brief forbids ingestion in F1. The field exists
  so WAVE 3 can render the panel and so populating it later is not a contract change.
- Toll figures inherit the WAVE 1 seed's DEMO status (three corridors, approximate 2024–2025
  fares). A route outside those corridors legitimately returns `tolls.total: 0`.
- No persistence, no rate limiting, no auth — F1 is anonymous and stateless.
