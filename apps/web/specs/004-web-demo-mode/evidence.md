# Evidence — `VITE_DEMO_MODE` demo mode

All commands run from the worktree
`.worktrees/j-20260909-ym-web--peggy-olson`, branch
`aipe/j-20260909-ym/web--peggy-olson` (base `dev`, on `d61eb03`).

## `/verify-before-done`

```
$ pnpm install
Lockfile is up to date, resolution step is skipped
Already up to date · Done

$ pnpm -w build
Tasks:    6 successful, 6 total          # geo, fuel, tolls, routing, api, web

$ pnpm --filter @qualroteiro/web typecheck
> tsc --noEmit                            # no output → clean

$ pnpm --filter @qualroteiro/web lint
> eslint src                              # no output → clean

$ pnpm --filter @qualroteiro/web test
 ✓ src/core/registry/architecture.test.ts        (4)
 ✓ src/core/api/client.test.ts                   (8)
 ✓ src/core/api/demo/handlers.test.ts            (10)   NEW
 ✓ src/core/map/MapCanvas.test.tsx               (8)
 ✓ src/core/components/PlaceSearch.test.tsx      (5)
 ✓ src/core/registry/extensibility.test.tsx      (6)
 ✓ src/core/api/demo/demoMode.test.tsx           (7)    NEW
 ✓ src/modules/rota-custos/rotaCustos.test.tsx   (15)
 Test Files  8 passed (8)
      Tests  63 passed (63)               # 46 pre-existing unchanged + 17 new
```

## Real demo build

```
$ rm -rf apps/web/dist
$ VITE_DEMO_MODE=true pnpm --filter @qualroteiro/web build
✓ 1689 modules transformed.
dist/index.html                     0.55 kB
dist/assets/index-*.css            86.32 kB
dist/assets/index-*.js              6.52 kB   # lazy demo chunk (fixtures + matchTolls/estimateFuel slice)
dist/assets/index-*.js           123.14 kB   # app
dist/assets/react-*.js           163.73 kB
dist/assets/maplibre-*.js        801.64 kB
✓ built in 4.11s

$ ls apps/web/dist
assets/  index.html               # self-contained static site, no backend needed

# fixtures land only in the lazy chunk, not the main app chunk:
$ grep -o demo-sao-paulo dist/assets/index-<6.5k>.js   → demo-sao-paulo
$ grep -o "modo demonstr[^\"]*" dist/assets/index-<app>.js → modo demonstração
```

## Acceptance mapping

| Acceptance | Proven by |
|---|---|
| build / typecheck / lint / test green; `pnpm -w build` green | above |
| `VITE_DEMO_MODE=true` build emits `dist/` | above |
| Demo ON, no fetch mock: Tela 1 → Tela 2 SP→RJ with trace + summary + Pedágios (≥1 Dutra plaza + tariff) + Combustível (`cost = 429.7/10*6`) | `demoMode.test.tsx` › "plans SP -> RJ (Dutra) from fixtures" (throwing `fetch` sentinel asserted never called) |
| Curitiba + Campinas corridors proven | `demoMode.test.tsx` › "plans SP -> Curitiba", "plans SP -> Campinas" |
| Demo OFF regression: 46 tests pass; flag off still hits `/api` | full run above + `demoMode.test.tsx` › "planRoute calls fetch(/api/routes/plan) when the flag is off" + unchanged `client.test.ts` |
| `PlaceSearch` demo resolves the 4 cities offline | `demoMode.test.tsx` › "offers the four fixture cities without touching the network" |
| Badge only when flag on | `demoMode.test.tsx` › "the modo demonstração badge" (on / off) |
| `.env.example` + `src/env.d.ts` document `VITE_DEMO_MODE` | both files edited |
| Diff only under `apps/web/**` (+ `pnpm-lock.yaml`) | `git diff --stat` |
| contract shapes (200/400/422, error body, `PlannedRoute`) | `handlers.test.ts` (all paths) |

## `/state-the-limit`

- No real browser and no real static-server run — proof is vitest + jsdom + the
  MapLibre stub, plus a real `VITE_DEMO_MODE=true` build that emits `dist/`.
- No deploy performed.
- Fixture `distanceKm` / `durationMin` are demo-grade constants; `tolls` / `fuel`
  are the real `matchTolls` / `estimateFuel` over demo-grade seed data (three
  Sudeste corridors only).
- Demo `/routes/plan` returns a single alternative, so the Alternativas tab shows
  one option under the flag.
- A known-city pair with no seeded corridor returns a `422` that reuses the
  "unresolved place" UX (spec Decision 3), not a distinct "no route" state.
- The demo module ships as an ~6.5 kB lazy chunk in every build (the `isDemoMode()`
  seam is a function call, deliberately, so it is test-overridable and therefore
  not statically tree-shaken); it is never fetched at runtime when the flag is off.
