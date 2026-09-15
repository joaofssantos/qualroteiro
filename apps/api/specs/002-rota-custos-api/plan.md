# Implementation Plan: Rota & Custos — HTTP API

**Spec**: [`spec.md`](./spec.md)
**Unit**: `qualroteiro/api` · **Journey**: `j-20260908-yk` · **Wave**: 2

---

## Summary

Compose the WAVE 1 domain packages behind two HTTP endpoints in `apps/api`. Write the two
concrete provider adapters (OpenRouteService routing + Pelias geocoding) that WAVE 1
deliberately left unimplemented, put them behind an injection seam so tests never touch the
network, and assemble `PlannedRoute` from `matchTolls` + `estimateFuel`. Tests first
(RED → GREEN) with vitest and Fastify's `.inject()`.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6+ (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) |
| Runtime | Node ≥ 20, ESM (`"type": "module"`) |
| HTTP | Fastify 5 + `@fastify/cors` (both already present) |
| Test runner | vitest 2.x + `app.inject()` — no port bound, no network |
| Domain deps | `@qualroteiro/{geo,routing,tolls,fuel}` via `workspace:*` |
| New runtime deps | **none** — `fetch` is built into Node 20 |
| Persistence | none exercised; Prisma skeleton left untouched |

---

## Key Decisions

**D-101 — `buildApp(deps)` is the injection seam.**
`src/app.ts` exports `buildApp({ routing, geocode })` returning a configured Fastify instance;
`src/server.ts` is reduced to composition root — it builds the real ORS adapters from `env`
and calls `listen`. Handlers close over the injected providers and never import an adapter
module. A test calls `buildApp({ routing: fakeRouting, geocode: fakeGeocode })` and gets the
production handlers with fake edges. Rejected alternative: a Fastify plugin decorating
`app.routing`, which works but pushes provider typing through module augmentation for no gain
at this size.

**D-102 — Hand-rolled request validation, no new dependency.**
The brief permitted Fastify JSON schema or zod. Both were rejected in favour of ~90 lines in
`src/http/validate.ts`. `origin`/`destination`/`waypoints[]` are a **union** of `string` and
`{lng,lat}`; JSON-schema `oneOf` produces AJV messages that name the union, not the field
("body/destination must match exactly one schema"), and the acceptance criterion requires the
message to name `destination`. zod would satisfy it but adds a runtime dependency to an app
whose only other runtime deps are Fastify and the workspace packages. Hand-rolling gives exact
control over every message and keeps the dependency list unchanged.

**D-103 — Geocoding resolves sequentially, and a zero-hit string is `422`, not `400`.**
A syntactically valid string that the geocoder simply cannot find is not a malformed request —
the client sent a well-formed field. `400` is reserved for shape/type/range violations the
client can fix by correcting the payload. This is an addition to the brief's stated codes, not
a change: the brief specified `400` for invalid bodies and `502` for provider failure and is
silent on "valid string, no hit". `422` is additive and cannot break WAVE 3's handling of the
specified codes.

**D-104 — Provider errors are wrapped in `ProviderError` → `502`.**
Both adapters throw `ProviderError` on non-2xx, on malformed vendor payloads and on timeout.
The handler catches it and maps to `502`; anything else propagates as a genuine `500`. This
keeps "the vendor is unhappy" (`502`) distinct from "our code has a bug" (`500`).

**D-105 — Adapter timeouts via `AbortSignal.timeout`.**
Node 20 built-in; default 15 s routing / 10 s geocoding, overridable per adapter. Prevents a
hung vendor from holding a Fastify connection open indefinitely.

**D-106 — ORS is called with GeoJSON output, so no polyline decoder is needed.**
`POST /v2/directions/{profile}/geojson` returns a `FeatureCollection` whose features carry
GeoJSON `LineString` geometry plus `properties.summary.{distance,duration}` in metres and
seconds. Converted to km and minutes in the adapter. This honours WAVE 1's stated reason for
standardising on GeoJSON (`routing/src/types.ts`) and keeps `@qualroteiro/geo` decoder-free.

**D-107 — `alternative_routes` requested, and its failure is non-fatal.**
ORS rejects `alternative_routes` on some plans and for some geometries. The adapter requests
alternatives, and on a 4xx that names the parameter it retries once without it, so a single
route is returned rather than a `502`. `routes[]` shape is identical either way.

**D-108 — `points.fuelStations` is `[]`, wired but unpopulated.**
The WAVE 1 seed exposes corridors and plazas only — inspected `packages/tolls/src/index.ts`,
there is no station export — and F1 forbids ingestion. The field ships as an empty array so
WAVE 3 can build the panel and later population is not a contract change. Recorded as a
limitation, not hidden.

**D-109 — `points.tolls` and `tolls.plazas` are the same array.**
`tolls` is the money view (plazas + total), `points` the map view (things to draw). They
coincide today because stations are empty. Kept separate because the brief's contract names
both and WAVE 3 renders them in different components.

---

## Architecture

```
src/
  server.ts              composition root: env → real adapters → buildApp → listen
  app.ts                 buildApp({ routing, geocode }) → FastifyInstance   ← THE SEAM
  env.ts                 ORS_API_KEY / ORS_BASE_URL reader
  errors.ts              ProviderError
  providers/
    ors-routing.ts       createOrsRoutingProvider(cfg): RoutingProvider
    ors-geocode.ts       createOrsGeocodeProvider(cfg): GeocodeProvider
  routes/
    health.ts            GET  /health
    places.ts            GET  /places/search
    plan.ts              POST /routes/plan
  http/
    validate.ts          hand-rolled body/query validation → ValidationError
tests/
  plan.test.ts           POST /routes/plan, fakes injected
  places.test.ts         GET /places/search, fake injected
  providers.test.ts      adapters against a stubbed fetch
```

Request flow for `POST /routes/plan`:

```
body → validate (400) → resolve place strings via GeocodeProvider (422 / 502)
     → RoutingProvider.route (502)
     → per alternative: matchTolls(geometry, axleCategory) + estimateFuel(distance, kmPerL, price)
     → 200 { routes: PlannedRoute[] }
```

---

## Test Strategy (RED → GREEN)

The test fake for routing returns `corridorPolyline('sp-rj-dutra')` from `@qualroteiro/tolls`
as its geometry. That is the seed's own reference trace, so `matchTolls` genuinely matches
Dutra's plazas at the real 500 m buffer — the toll assertions exercise actual geometry rather
than a hand-stubbed number. Distance is set to `429.7` km, inside the required `400..470`.

Fuel tolerance: `±0.01`, because `estimateFuel` rounds cost to cents.

No test binds a port, opens a socket, or reads a database.

---

## Tasks

| # | Task | State |
|---|---|---|
| T1 | vitest + config as devDeps under `apps/api`; `test`/`typecheck` scripts | done |
| T2 | RED: `plan.test.ts`, `places.test.ts` against a not-yet-existing `buildApp` | done |
| T3 | `errors.ts`, `http/validate.ts` | done |
| T4 | `app.ts` + route modules — GREEN | done |
| T5 | ORS adapters + `providers.test.ts` against a stubbed `fetch` | done |
| T6 | `server.ts` as composition root; `.env.example` gains `ORS_*` | done |
| T7 | build + typecheck + test green from the worktree | done |

---

## Out of Scope

Root config (`turbo.json`, `tsconfig.base.json`, root `package.json`, `pnpm-workspace.yaml`),
`apps/web`, Prisma schema and migrations, infra vars owned by `qualroteiro/root`, self-hosted
Valhalla/Photon, toll-data ingestion, persistence, auth, rate limiting.
