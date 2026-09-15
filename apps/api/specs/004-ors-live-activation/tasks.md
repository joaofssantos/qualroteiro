# Task doc — activate real OpenRouteService routing (T2)

Filled in as the work landed (sdd-lite §3). What changed, how it was
verified, what was left out.

## What changed

| File | Change |
|---|---|
| `apps/api/src/env.ts` | New `loadDotEnvInto(target, path = '.env')` export, backed by a ~25-line hand-rolled `.env` parser (`KEY=VALUE`, `#`-comments, blank lines, optional matching quotes stripped). Merges into `target` without overwriting a key already present. Missing file → silent no-op. No new dependency. |
| `apps/api/src/server.ts` | Calls `loadDotEnvInto(process.env)` before `readOrsEnv()`. One line of logic + a comment. |
| `apps/api/tests/env.test.ts` | 3 new tests for `loadDotEnvInto`: loads a temp-dir fixture file and round-trips through `readOrsEnv`; never overwrites a variable the process already has; no-op when the file is absent. |
| `apps/api/specs/004-ors-live-activation/{spec.md,tasks.md}` | This SDD. |

**`ors-routing.ts` / `ors-geocode.ts`: no change.** The real calls (below)
succeeded on the first try with correctly-mapped fields — profile string,
`Authorization` header format, GeoJSON `features[].geometry.coordinates` →
`LineString`, `properties.summary.{distance,duration}` → km/min, Pelias
`properties.{gid,label,layer}` → `Place` were all correct against the live
service. No bug was found in either adapter.

## The bug found and fixed

`apps/api/.env` (gitignored, real `ORS_API_KEY` + `ORS_BASE_URL` provisioned
by the PE) was never loaded into `process.env` by anything — `dev` runs
`tsx watch src/server.ts` and `start` runs `node dist/server.js`, neither
with an env-file mechanism. `readOrsEnv()` correctly reads
`process.env.ORS_API_KEY` and correctly throws when absent — but it always
saw absent, real key on disk or not, so the server refused to start
unconditionally. Confirmed as a wiring bug, not a key problem: the key in
`.env` is well-formed (verified length/format without printing it) and
`ORS_BASE_URL` is the correct public endpoint.

Two alternatives were tried and rejected before the shipped fix:

1. Node's native `--env-file=.env` flag
   (`tsx watch --env-file=.env src/server.ts`) — confirmed working, but
   leaves no application code to unit-test (the mechanism is Node's own
   flag, not something exercisable without spawning a real child process
   per test), and the brief's evidence bar wants a RED→GREEN test.
2. The `dotenv` npm package — works, but adding it as a dependency produced
   a `pnpm-lock.yaml` delta at the repo root, which fails this unit's own
   acceptance line ("`git diff --name-only origin/dev..HEAD` shows only
   `apps/api/**`"). Reverted.

Shipped: a ~25-line in-repo parser (`apps/api/.env` only ever needs
`KEY=VALUE`), fully unit-testable, zero new dependency, zero lockfile delta.

### RED → GREEN

```
$ git stash push -- src/env.ts src/server.ts
$ pnpm vitest run tests/env.test.ts
 FAIL  tests/env.test.ts > loadDotEnvInto > loads a .env file into the target env object …
 FAIL  tests/env.test.ts > loadDotEnvInto > never overwrites a variable the process already has …
 FAIL  tests/env.test.ts > loadDotEnvInto > is a silent no-op when the file does not exist …
 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
$ git stash pop
$ pnpm vitest run tests/env.test.ts
 ✓ tests/env.test.ts (6 tests)
```

## How it was verified

From the worktree
(`/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/.worktrees/j-20260915-er-api--pete-campbell`):

- `pnpm install` — clean, no new dependency (the `dotenv` package trial was
  reverted; `pnpm install` afterward showed zero `pnpm-lock.yaml` diff).
- `pnpm -w build` (`turbo run build`) — needed once on a clean checkout so
  `@qualroteiro/{geo,routing,tolls,fuel}` have a `dist/` to resolve against
  (the `dev`/`start` scripts otherwise fail with `ERR_MODULE_NOT_FOUND` —
  pre-existing, unrelated to this unit, not touched). 6/6 tasks succeeded.
- `pnpm --filter @qualroteiro/api test` → **37 tests passed** (34 original +
  3 new: `env.test.ts` 6, `providers.test.ts` 10, `places.test.ts` 5,
  `plan.test.ts` 16), exit 0. No network, no real key — `providers.test.ts`
  still runs entirely against a stubbed `fetch`.
- `pnpm --filter @qualroteiro/api typecheck` → exit 0.
- `pnpm --filter @qualroteiro/api lint` → exit 0, no findings.
- `pnpm --filter @qualroteiro/api dev` with the real `.env` present → logs
  `"Server listening at http://127.0.0.1:3000"` within ~1s, no manual env
  injection. (Before the fix: `Error: ORS_API_KEY is not set...` thrown at
  the composition root, even with the same `.env` present.)
- `pnpm --filter @qualroteiro/api start` (against the `tsc` build) → same
  clean boot; `GET /health` → `{"status":"ok"}`, HTTP 200.
- **Real `POST /routes/plan`**
  (`{origin:"São Paulo, SP", destination:"Rio de Janeiro, RJ",
  vehicle:{type:"car",axleCategory:"car",consumptionKmPerL:10},
  fuelPricePerL:6}`) → HTTP 200:
  - `routes.length`: 1
  - `geometry.type`: `LineString`, **`geometry.coordinates.length`: 3,811**
    (road-following — far more than the 2-point fake/stub geometry;
    confirms real ORS directions data, not a straight line)
  - `distanceKm`: 405.462, `durationMin`: 319.83
  - `tolls.total`: 11.5 (`tolls.plazas.length`: 1 — expected against the
    WAVE 1 seed corridor data, out of scope here)
  - `fuel`: `{ liters: 40.546, cost: 243.28 }`
- **Real `GET /places/search?q=São Paulo`** → HTTP 200, 5 places, e.g.
  `{ id: "whosonfirst:locality:101965533", label: "São Paulo, Brazil",
  lng: -46.663713, lat: -23.570533, kind: "locality" }` plus 4 more
  (a neighbourhood and three other Brazilian "São Paulo"/"Paulo" localities —
  `boundary.country=BRA` filtering confirmed working).
- `git status` before every command that could commit: `.env` never listed
  (root `.gitignore` covers `.env` / `.env.*` with `!.env.example`).
- `git diff --name-only origin/dev..HEAD` (checked after staging): only
  `apps/api/src/env.ts`, `apps/api/src/server.ts`,
  `apps/api/tests/env.test.ts`, `apps/api/specs/004-ors-live-activation/*`.
  No `pnpm-lock.yaml`, no `.env`, no file containing the raw key.

## What was left out

- No change to `ors-routing.ts` / `ors-geocode.ts` — real calls found no bug.
- The D-107 alternative-routes-retry-on-4xx path was not reproduced live
  (ORS returned a single route for SP→RJ, which the existing fake-based test
  already covers as a distinct scenario) — see spec Limits.
- The `driving-hgv` truck profile was not exercised live, only via the
  existing fake-based test — see spec Limits.
- No CI workflow changes — out of scope for this unit.
