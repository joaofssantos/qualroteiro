# sdd-lite — activate real OpenRouteService routing (T2)

**Journey**: `j-20260915-er` (T2 — first real call against the live ORS
adapter)
**Unit**: `qualroteiro/api`
**Scope**: `apps/api` only. No `apps/web`, `packages/**`, `turbo.json`,
`tsconfig.base.json`, root `package.json`, `pnpm-workspace.yaml` edits, and
(per this unit's own brief) no `pnpm-lock.yaml` edit either — the fix below
adds no new dependency.
**SDD route**: `aipe skill match --task-type feature --size small` →
`sdd=sdd-lite` (size small is below spec-kit's medium threshold → the light
sdd-lite floor). Kept at `small`: the real fix is a ~30-line bootstrap helper
plus tests, not an adapter redesign.

---

## Problem

`apps/api/src/providers/ors-routing.ts` and `ors-geocode.ts` are real,
previously-unexercised OpenRouteService adapters — all 34 existing tests run
them against a stubbed `fetch`, never the live service. This unit makes the
first real calls and fixes whatever they reveal.

**What the real calls revealed**: not an adapter bug. `apps/api/.env` (real
`ORS_API_KEY` + `ORS_BASE_URL`, gitignored) was already correctly provisioned,
but nothing in the boot path ever loaded it. `apps/api/package.json`'s `dev`
script (`tsx watch src/server.ts`) and `start` script (`node dist/server.js`)
both run with a bare `process.env` — no `--env-file` flag, no dotenv import,
nothing. `src/env.ts#readOrsEnv` correctly reads `process.env.ORS_API_KEY`
and correctly throws when it's absent, exactly as designed
("fail loudly... beats every request failing later with a confusing 502").
But it always saw an absent key, because `.env` was never read into
`process.env` in the first place — so the server refused to start
unconditionally, real key on disk or not. This is a startup wiring bug, not a
key problem (confirmed: the key in `.env` is well-formed and the correct
base URL is set).

Once the server was booted with the key manually injected into the shell
environment (bypassing the bug, to first confirm the adapters themselves are
sound), both live calls succeeded on the first try with correctly-mapped
fields: `POST /routes/plan` returned road-following geometry (3,811 points,
not the 2-point stub the fakes use), `distanceKm`/`durationMin`/`tolls.total`/
`fuel.cost` all populated and sane; `GET /places/search` returned 5
correctly-parsed Pelias features. **No change was needed in
`ors-routing.ts` or `ors-geocode.ts`.**

## Scope

**In**

- `apps/api/src/env.ts` — new `loadDotEnvInto(target, path = '.env')`
  export: reads a `.env`-style file (own ~25-line parser: `KEY=VALUE` lines,
  `#`-comments, blank lines, optional matching quotes stripped — no
  interpolation, no multiline; apps/api's `.env` only ever needs
  `KEY=VALUE`) and merges it into `target` **without overwriting a key
  `target` already has**. Absent file → silent no-op.
- `apps/api/src/server.ts` — calls `loadDotEnvInto(process.env)` before
  `readOrsEnv()`, so a developer's `.env` is actually picked up. One
  four-line change at the composition root; no other file constructs real
  adapters.
- `apps/api/tests/env.test.ts` — 3 new tests for `loadDotEnvInto` (loads a
  fixture file; never overwrites a variable the process already has; no-op
  when the file doesn't exist), using a temp directory, never the real
  `apps/api/.env` or the real key.

**Out**

- Any change to `ors-routing.ts` / `ors-geocode.ts` — the real calls found
  no bug in either adapter (see Problem). Not touched.
- Any change to `apps/api/specs/002-rota-custos-api/spec.md` (the HTTP
  contract) — nothing here changes a field name, a status code, or a route
  shape.
- Adding the `dotenv` npm package — considered first, rejected: it would add
  a dependency and a `pnpm-lock.yaml` delta outside `apps/api/**`, which this
  unit's brief forbids (`git diff` must show only `apps/api/**`). A ~25-line
  hand-rolled parser for `KEY=VALUE` lines needs no dependency.
- Node's native `--env-file` flag as an alternative (tested working via
  `tsx watch --env-file=.env src/server.ts`) — rejected because it leaves no
  application code to unit-test the fix (the flag itself is Node's own
  tested feature, not something this unit's test suite can exercise without
  spawning a real child process per test run); the in-repo parser is
  equally dependency-free and is directly unit-testable.

## Decisions / assumed contracts

1. **Existing `process.env` always wins over the file.** A real deployment
   injects `ORS_API_KEY` directly (platform secrets, no `.env` file present
   at all); `loadDotEnvInto` must never let a stray `.env` shadow that. Tested
   explicitly.
2. **Missing file is a silent no-op**, not an error — production has no
   `.env` by design (per `.env.example`'s own comments), and that must stay a
   normal, unremarkable path.
3. **No new dependency.** `apps/api/.env` is two `KEY=VALUE` lines; a full
   dotenv-format parser (interpolation, multiline, export prefixes, etc.) is
   out of proportion to that, and pulling in `dotenv` would touch
   `pnpm-lock.yaml` outside this unit's declared scope.
4. **`env.ts` keeps its existing style** — `readOrsEnv` already takes an
   explicit env object "so tests stay order-independent"
   (see its test file's own header comment); `loadDotEnvInto` follows the
   same shape (`target` passed in, not implicitly `process.env`), with
   `server.ts` the only caller that passes the real `process.env`.

## Acceptance (observable)

- `pnpm --filter @qualroteiro/api test` → exit 0, **37 tests** (34 original +
  3 new for `loadDotEnvInto`), no network, no real key.
- `pnpm --filter @qualroteiro/api typecheck` → exit 0.
- `pnpm --filter @qualroteiro/api lint` → exit 0.
- `pnpm --filter @qualroteiro/api dev` (after `pnpm -w build` once, for the
  workspace packages' `dist/`), with the real `apps/api/.env` present →
  boots and logs "Server listening", no manual env injection needed.
- Real `POST /routes/plan` against the booted server: 200, road-following
  geometry (3,811 points for SP→RJ, far more than a straight-line 2/8-point
  stub), `distanceKm`/`durationMin`/`tolls.total`/`fuel.cost` all populated.
- Real `GET /places/search?q=São Paulo` against the booted server: 200, 5
  correctly-labeled/coordinated places.
- `git diff --name-only origin/dev..HEAD` shows only `apps/api/**` — no
  `pnpm-lock.yaml`, no `.env`, no file containing the raw key.

## Limits (`/state-the-limit`)

- This unit does not add a `--env-file`/dotenv convention anywhere outside
  `apps/api` — other units in this workspace with the same class of bug are
  not covered.
- `loadDotEnvInto`'s parser intentionally does not support variable
  interpolation (`FOO=${BAR}`), multiline values, or an `export` prefix —
  `apps/api/.env` never needs them; a unit that does will need a real
  `dotenv` dependency instead.
- Only one live routing call (SP→RJ, car profile, no waypoints) and one live
  geocode call were made. The D-107 alternative-routes retry path and the
  `driving-hgv` truck profile are exercised only by the existing fake-based
  tests, not confirmed live — a live 400-on-alternatives response was not
  observed/reproduced in this session (ORS returned a single route for this
  city pair, which is plausible: no sufficiently distinct alternative for
  Via Dutra under the default `share_factor`/`weight_factor`, not evidence of
  a defect).
