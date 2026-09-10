# Task doc — `VITE_DEMO_MODE` demo mode

Filled in as the work lands (sdd-lite §3). What changed, how it was verified,
what was left out.

## What changed

| File | Change |
|---|---|
| `apps/web/.env.example` | Documents `VITE_DEMO_MODE` (default `false`, `'true'` to enable). |
| `apps/web/src/env.d.ts` | `readonly VITE_DEMO_MODE?: string` on `ImportMetaEnv`. |
| `apps/web/package.json` | Adds `@qualroteiro/fuel` as a `workspace:*` dependency. |
| `apps/web/src/core/api/demo/mode.ts` | New. `isDemoMode()` — the one seam; reads `import.meta.env.VITE_DEMO_MODE` once into a const, plus `setDemoModeForTests()` (test-only). |
| `apps/web/src/core/api/demo/fixtures.ts` | New. `DEMO_CITIES` (4), `DEMO_CORRIDORS` (3), `normalizeText`, `searchDemoCities`, `resolveDemoCity`, `buildPlannedRoute` (real `matchTolls` + real `estimateFuel`). |
| `apps/web/src/core/api/demo/handlers.ts` | New. `demoSearchPlaces` / `demoPlanRoute` — return a `Response` mimicking the WAVE 2 contract (200 / 400 / 422). |
| `apps/web/src/core/api/demo/index.ts` | New. Barrel: re-exports the two handlers. |
| `apps/web/src/core/api/client.ts` | `planRoute` / `searchPlaces` branch on `isDemoMode()`: demo → `await import('./demo')` and feed its `Response` through the unchanged `toApiError` / `.json()` path. Non-demo branch unchanged. |
| `apps/web/src/core/shell/AppShell.tsx` | Renders a `role="status"` "modo demonstração" badge when `isDemoMode()`. |
| `apps/web/src/core/api/demo/handlers.test.ts` | New. Unit tests for the two handlers (all status codes, all 3 corridors, direction, no-corridor). |
| `apps/web/src/core/api/demo/demoMode.test.tsx` | New. Full-app demo-ON e2e for the 3 corridors + PlaceSearch-in-demo + badge visibility + demo-OFF still hits `fetch`. |
| `apps/web/README.md` | New. "Homolog / demo build" section. |
| `pnpm-lock.yaml` | One importer entry for `@qualroteiro/fuel` (from `pnpm install`). |

## How it was verified

See `evidence.md` for captured command output. Summary:

- `pnpm install` (worktree root) — clean.
- `pnpm -w build` — green (all 6 packages).
- `pnpm --filter @qualroteiro/web typecheck` — green.
- `pnpm --filter @qualroteiro/web lint` — green.
- `pnpm --filter @qualroteiro/web test` — green (46 pre-existing + new demo tests).
- `VITE_DEMO_MODE=true pnpm --filter @qualroteiro/web build` — green, `dist/` emitted.

## What was left out

- No real browser / real static-server run (jsdom + MapLibre stub only).
- Demo `/routes/plan` returns a single alternative.
- No-corridor pair reuses the "unresolved place" 422 UX (spec Decision 3).
- Fixture distances/durations are demo-grade constants.
