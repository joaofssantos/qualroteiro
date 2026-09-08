# Implementation Plan: Rota & Custos — Domain Packages

**Spec**: [`spec.md`](./spec.md) · **Tasks**: [`tasks.md`](./tasks.md)
**Unit**: `qualroteiro/root` · **Journey**: `j-20260908-yk`

---

## Summary

Add four pure-domain workspace packages under `packages/` — `geo`, `routing`, `tolls`, `fuel` —
wired into the existing pnpm + Turborepo graph. `geo` carries the geodesic primitives, `tolls`
consumes them to match plazas against a route polyline, `fuel` is standalone arithmetic, and
`routing` is a provider-shaped interface with no implementation. Tests are written first
(RED → GREEN) with vitest, per package.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) |
| Runtime | Node ≥ 20 (`.nvmrc`: 20), ESM (`"type": "module"`) |
| Package manager | pnpm 9.12 workspaces |
| Task graph | Turborepo 2.x (`build` → `^build`; `typecheck`/`test` → `^build`) |
| Test runner | vitest (devDependency per package) |
| Runtime deps | **none** — see Decision D-001 |
| Target platform | library packages, consumed by `apps/api` |

---

## Key Decisions

**D-001 — Hand-rolled geodesic math, zero runtime dependencies.**
`@turf/*` was permitted by the brief. Rejected: at this scale we need exactly three primitives
(haversine distance, point-to-segment projection, interpolation along a line). Hand-rolling
them is ~120 lines, keeps every package's runtime dependency list **empty**, and makes the
"no HTTP client in `dist/`" acceptance trivially and permanently true — no transitive surface
to audit. Accuracy is more than sufficient: point-to-segment uses a local equirectangular
projection, whose error at the ~500 m buffer scale is well under a metre.

**D-002 — Route geometry is GeoJSON `LineString`, not an encoded polyline.**
The brief said pick one and document it. GeoJSON wins: it is self-describing, needs no decoder
in `geo`/`tolls`, is what `apps/web` will hand to MapLibre directly, and every managed routing
vendor can emit it. Coordinates are `[lng, lat]` pairs, per the GeoJSON spec's axis order.
A provider that speaks encoded polyline decodes **in its own adapter**, inside `apps/api`.

**D-003 — Buffer constant `TOLL_MATCH_BUFFER_METERS = 500`.**
Exported from `@qualroteiro/tolls` so it is inspectable and overridable per call. 500 m is wide
enough to absorb the coarseness of a demo reference polyline and of vendor geometry
simplification, and narrow enough that a parallel highway does not falsely claim a plaza.

**D-004 — Two tsconfigs per package.**
`tsconfig.json` (`include: ["src"]`, emits to `dist/`) drives `build`; `tsconfig.test.json`
(adds `tests/`, `noEmit`) drives `typecheck`. Consequence: tests are type-checked but **never
emitted**, so the fake `RoutingProvider` in `routing`'s tests can never leak into `dist/` —
which is exactly what acceptance SC-005 checks.

**D-005 — Tariff tables built from a base fare × standard multiplier.**
Brazilian tolls price by axle category on a well-known multiplier ladder (motorcycle ½, car 1,
2-axle commercial 2, 3-axle 3, …). The seed stores one base fare per plaza and expands it
through a documented `tariffTable()` helper, so the data stays legible and internally
consistent instead of being eight hand-typed numbers per plaza.

**D-006 — `estimateFuel` rounds; `matchTolls` totals in cents.**
`liters` to 3 dp, `cost` to 2 dp (BRL has cents). Toll totals are summed in integer cents and
converted back, so `total` never drifts by float accumulation across six plazas.

---

## Project Structure

```
packages/
├── geo/
│   ├── src/{index,types,geometry}.ts        # LngLat, Place, GeocodeProvider, LineString
│   ├── tests/geometry.test.ts               # inside-buffer + outside-buffer
│   ├── package.json  tsconfig.json  tsconfig.test.json  README.md
├── routing/
│   ├── src/{index,types}.ts                 # RoutingProvider, RouteRequest/Result/Alternative
│   ├── tests/contract.test.ts               # in-memory fake — TEST ONLY
│   └── …
├── tolls/
│   ├── src/{index,types,match,tariff}.ts
│   ├── src/seed/{index,dutra,regis-bittencourt,bandeirantes}.ts
│   ├── tests/{match,seed}.test.ts
│   └── …                                    # depends on @qualroteiro/geo
└── fuel/
    ├── src/{index,estimate}.ts
    ├── tests/estimate.test.ts
    └── …
specs/001-rota-custos-domain-packages/{spec,plan,tasks}.md
```

**Dependency direction** (enforced by review, asserted in `tasks.md` T-14):

```
fuel        (no deps)
geo         (no deps)
routing     (no deps)
tolls  ──▶  geo
```

`geo` and `routing` never import `tolls` or `fuel`.

---

## Root config changes (deliberately minimal)

- `pnpm-workspace.yaml` — **unchanged**; `packages/*` is already globbed.
- `tsconfig.base.json` — **unchanged**. No path aliases, no project references: packages
  resolve through pnpm workspace links and their own `exports` + `types`, so `apps/*` keep
  type-checking exactly as they do today.
- `turbo.json` — one addition: `test` gets `"outputs": []` and `dev`-style cache behaviour is
  left alone. `build`/`typecheck`/`test` already depend on `^build`, which is what the new
  `tolls → geo` edge needs.
- root `package.json` — **unchanged**; `turbo run test` already exists and now finds tasks.
- `.nvmrc` — **unchanged**.

---

## Interface stability for the `api` wave

`apps/api` will implement `RoutingProvider` and `GeocodeProvider` against a managed vendor.
The interfaces are shaped so no change here is needed:

- both are single-method, `Promise`-returning, and take a plain request object — an adapter
  holding an API key in a closure or a constructor satisfies them;
- `RouteRequest.profile` is an open `string`, so vendor-specific profiles (`auto`, `truck`,
  `motorcycle`) pass through without a union edit here;
- `RouteResult.routes` is an array, so single-route vendors return a one-element array and
  alternatives-capable vendors return many, with no signature change;
- nothing in the request or result mentions a vendor, a key, a base URL, or a transport.

---

## Risks

- **R-001 — `pnpm -w install` under-installs.** The acceptance brief specifies
  `pnpm -w install`, but pnpm's `-w` is `--workspace-root`: it installs the root importer only,
  leaving `apps/web` without `vite` and making a subsequent `pnpm -w build` fail on
  `Cannot find type definition file for 'vite/client'`. **This reproduces on the untouched base
  commit** — it is not caused by this unit. Mitigation: verification runs plain `pnpm install`
  and reports both commands' behaviour. Flagged to the coordinator, not silently patched,
  since the acceptance wording is the ledger's.
- **R-002 — Seed accuracy.** Tariffs and coordinates are approximated; a real corridor may
  have gained or lost a plaza. Contained by A-001 and the README warning. Not verifiable
  inside this unit.
- **R-003 — Buffer false positives** where two tolled highways run parallel within 500 m.
  Not present in the three seeded corridors; revisit when the seed grows or when real vendor
  geometry replaces the reference polylines.

---

## Constitution Check

No project constitution file exists at `.specify/memory/`; no gate to evaluate. The unit
respects the orientation spec's standing constraints: backend-first, provider behind an
interface, hand-curated toll seed, anonymous/no-auth.

---

## Complexity Tracking

No deviation requiring justification. Four packages is the count the orientation spec named;
zero runtime dependencies is below, not above, the expected budget.
