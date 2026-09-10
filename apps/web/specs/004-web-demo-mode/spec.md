# sdd-lite — `apps/web` build-time demo mode (`VITE_DEMO_MODE`)

**Journey**: `j-20260909-ym` (single wave)
**Unit**: `qualroteiro/web`
**Scope**: `apps/web` only. No `apps/api`, no `packages/**` edits, no root config
(a `pnpm-lock.yaml` change from adding `@qualroteiro/fuel` as an `apps/web`
workspace dependency is expected and allowed).
**SDD route**: `aipe skill match --task-type feature --size small` → `sdd=sdd-lite`
(size small < the medium threshold for spec-kit).

---

## Problem

A static deploy of `apps/web` (a homolog / demo bundle served with no backend)
has no `/api` origin, so `POST /api/routes/plan` and `GET /api/places/search`
fall through to the SPA and return `index.html` — the app "returns nothing".
We need a **build-time demo mode** so a standalone `dist/` works with fixture
data for the three seeded corridors, without a service worker and without
changing the real network path.

## Scope

**In**

- `VITE_DEMO_MODE` build flag — documented in `apps/web/.env.example`, typed in
  `apps/web/src/env.d.ts`. Default `false`.
- A single seam, `src/core/api/demo/mode.ts` (`isDemoMode()`), that reads
  `import.meta.env.VITE_DEMO_MODE === 'true'` **once** into a module constant,
  plus a test-only override (`setDemoModeForTests`).
- `src/core/api/demo/` fixtures module that mimics the WAVE 2 HTTP contract
  (`apps/api/specs/002-rota-custos-api/spec.md`):
  - `GET /places/search?q=` → fixture `Place[]` for São Paulo, Rio de Janeiro,
    Curitiba, Campinas (case-insensitive substring match on `label`); blank `q`
    → `400` naming `q`; no match → `200 { places: [] }`.
  - `POST /routes/plan` → one `PlannedRoute` per seeded corridor: SP↔RJ (Dutra),
    SP↔Curitiba (Régis Bittencourt), SP↔Campinas (Bandeirantes). Geometry is the
    seed's `referencePolyline` from `@qualroteiro/tolls` (reversed for the return
    trip). `tolls` from the **real `matchTolls`** (`axleCategory` from the
    request, `corridorHint` set). `fuel` from the **real `estimateFuel`**.
    `points.tolls` = the same plazas; `points.fuelStations` = `[]`.
  - Fixed `distanceKm`/`durationMin` per corridor: SP→RJ `429.7 / 342.5`,
    SP→Curitiba `408 / 352`, SP→Campinas `96 / 82`.
  - An origin/destination pair that resolves to two known cities but is **not** a
    seeded corridor → `422` whose message is prefixed `destination:` (see
    Decisions). A string/coord that resolves to no known city → `422` prefixed
    `origin:` / `destination:` for the offending endpoint.
- The fetch layer (`src/core/api/client.ts`) branches on `isDemoMode()`: in demo
  mode it `await import('./demo')` and resolves from a built `Response` that runs
  through the **existing** `toApiError` / body-parsing path. The non-demo branch
  is byte-for-byte the current code.
- A "modo demonstração" badge in the app shell (`src/core/shell/AppShell.tsx`),
  rendered only when `isDemoMode()`.
- Doc: `apps/web/README.md` — how to build the homolog bundle.

**Out**

- Any service worker or request interception. The mock lives in the fetch layer,
  versioned and unit-tested.
- Any change to `apps/api`, `packages/**`, `services/**`, infra or root config.
- Real routing/geocoding fidelity — fixtures are demo-grade (they inherit the
  WAVE 1 seed's DEMO status).
- Alternatives in demo mode: `/routes/plan` returns exactly one route per
  corridor (the contract allows one-or-more; one is enough for a demo).

## Decisions / assumed contracts

1. **Flag семантика** — `VITE_DEMO_MODE` is a string env var (Vite convention);
   `'true'` (exact) enables demo mode, anything else (including unset) disables
   it. Read once at module load so a production build with the flag unset inlines
   `false` and the demo branch is dead code.
2. **Contract mimicry via `Response`** — the demo handlers return a real
   `Response` object (JSON body + status), so `client.ts` reuses its existing
   `!response.ok → toApiError` and `response.json()` logic unchanged. The error
   taxonomy (`validation` / `unresolved-place` / `provider`) is therefore
   identical to the live path by construction.
3. **No-corridor pair → `422` prefixed `destination:`** — the client's
   `fieldFromMessage` parser keys on `^(origin|destination|waypoints\[\d+\]):`.
   When both endpoints resolve to known cities but no seeded corridor connects
   them (e.g. Rio → Curitiba), the trip has no known route *to the destination*,
   so the message is `destination: não há corredor de demonstração entre …`.
   `NewQueryScreen` then pins an "endereço não encontrado" message to the
   destination field and stays on Tela 1 — the same UX as a real unresolved
   place. This is a demo-grade approximation, documented here per the brief.
4. **`@qualroteiro/fuel` dependency** — added to `apps/web/package.json` as
   `workspace:*` (it was already a workspace package on `dev`, just not a web
   dependency). This is an `apps/web`-local edit; the resulting `pnpm-lock.yaml`
   delta is one importer entry.
5. **Corridor direction** — the seed corridors are SP→X. The demo resolves the
   reverse trip too (X→SP), reusing the same polyline reversed; `matchTolls` is
   order-independent so tolls are unchanged.
6. **`durationMin` display** — `SummaryRow` renders `formatDuration`; the fixed
   values were chosen to read plausibly (SP→RJ `342.5` → "5 h 43 min").

## Acceptance (observable)

- `pnpm --filter @qualroteiro/web {build,typecheck,lint,test}` and `pnpm -w build`
  all green.
- `VITE_DEMO_MODE=true pnpm --filter @qualroteiro/web build` produces `dist/`.
- **Demo ON** (`setDemoModeForTests(true)`, a throwing `fetch` sentinel, no API
  mock): submitting Tela 1 with origin "São Paulo, SP" / destination "Rio de
  Janeiro, RJ" / consumo 10 / combustível 6 reaches Tela 2 with the route trace
  on the map, the summary populated, the **Pedágios** tab listing ≥1 Dutra plaza
  with a tariff, and the **Combustível** tab showing `cost = liters × price`
  (`429.7 / 10 * 6` within tolerance). SP→Curitiba and SP→Campinas proven the
  same way. The `fetch` sentinel is never called.
- **Demo OFF** (default): the existing 46 web tests pass unchanged; with the flag
  off `planRoute` still calls `fetch('/api/routes/plan')` (asserted).
- `PlaceSearch` in demo mode resolves the 4 cities from fixtures with the `fetch`
  sentinel never called.
- The "modo demonstração" badge renders only when the flag is on.
- `.env.example` and `src/env.d.ts` document `VITE_DEMO_MODE`.

## Limits (`/state-the-limit`)

- No real browser run and no real static-server run were performed; proof is
  vitest + jsdom + the MapLibre stub, plus a real `VITE_DEMO_MODE=true` build
  that emits `dist/`.
- Fixture distances/durations are demo-grade constants; toll and fuel figures are
  real functions over demo-grade seed data (three Sudeste corridors only).
- Demo `/routes/plan` returns a single alternative, so the Alternativas tab shows
  one option in demo mode.
- The no-corridor `422` reuses the "unresolved place" UX (Decision 3); it is not
  a distinct "route not available" state.
