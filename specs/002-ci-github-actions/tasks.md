# Task doc — CI (GitHub Actions)

Filled in as the work lands (sdd-lite §3). What changed, how it was verified,
what was left out.

## What changed

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | New. One job (`verify`, `ubuntu-latest`) on `pull_request`/`push` to `[dev, main]`, `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`. Steps: `actions/checkout@v4` → `pnpm/action-setup@v4` (no `version:` pin — reads `packageManager: "pnpm@9.12.0"` from root `package.json` via the action's documented auto-detection) → `actions/setup-node@v4` (`node-version: 20`, `cache: pnpm`) → `actions/cache@v4` on `.turbo-cache` keyed on `${{ runner.os }}-turbo-${{ hashFiles('pnpm-lock.yaml') }}` with a `restore-keys` prefix fallback → `pnpm install --frozen-lockfile` → `pnpm -w build` → `pnpm -w typecheck` → `pnpm -w lint` → `pnpm -w test`. A job-level `env: TURBO_CACHE_DIR: .turbo-cache` redirects Turborepo's filesystem cache into that repo-relative, cacheable directory (turbo's default local cache dir lives outside the repo on this machine, and is pointless to cache on an ephemeral runner) — confirmed with a local test rather than assumed; see below. |
| `README.md` | One line added: a CI status badge pointing at `.github/workflows/ci.yml` on `origin` (`joaofssantos/qualroteiro`). No other README changes. |
| `specs/002-ci-github-actions/spec.md`, `specs/002-ci-github-actions/tasks.md` | sdd-lite mini-spec + this task doc. |

## How it was verified

From the worktree root
(`/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/.worktrees/j-20260910-hq-root--lane-pryce`),
HEAD confirmed at `aba1cde` before starting:

- **Blocker re-check**: `pnpm -w lint` → `2 successful, 2 total`, `>>> FULL
  TURBO` — confirms Wave 1's `apps/api/eslint.config.js` fix holds on this
  base before building CI on top of it.
- **`TURBO_CACHE_DIR` redirect, verified not assumed**: ran
  `TURBO_CACHE_DIR=<relative-dir> pnpm -w build --force` twice (an absolute
  `/tmp` path, then a repo-relative path) and in both cases the `.tar.zst` /
  `-manifest.json` / `-meta.json` cache artifacts landed inside that exact
  directory instead of turbo's machine-global default cache home — this is
  what justifies the workflow's `env:` + `actions/cache@v4` combination
  without touching `turbo.json` (out of scope). Test directories removed
  afterward; `git status --short` clean.
- **YAML validity**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
  parses without error (`pyyaml` installed locally for this check — not a
  repo dependency). Note: PyYAML's default (YAML 1.1) resolver reads the
  unquoted top-level `on:` key as the boolean `True` in its parsed dict; this
  is a known PyYAML/YAML-1.1 quirk, not a workflow bug — GitHub Actions'
  parser (YAML-1.2-like key handling) reads `on:` as the literal string key,
  as does every other GitHub Actions workflow that uses the same, universal
  unquoted `on:` convention. `actionlint` was not available on this machine
  (`which actionlint` → not found) — noted as a limit rather than skipped
  silently.
- **Exact local sequence, clean state**, matching the workflow's steps 1:1:
  - `pnpm install --frozen-lockfile` → `Lockfile is up to date, resolution
    step is skipped` / `Already up to date`, exit 0.
  - `pnpm -w build` → `Tasks: 6 successful, 6 total`.
  - `pnpm -w typecheck` → `Tasks: 10 successful, 10 total`.
  - `pnpm -w lint` → `Tasks: 2 successful, 2 total` (only `@qualroteiro/api`
    and `@qualroteiro/web` declare a `lint` script; `packages/*` don't,
    which is expected and unchanged from Wave 1).
  - `pnpm -w test` → `Tasks: 10 successful, 10 total`. Re-ran once more with
    `npx turbo run test --force` (cache fully bypassed, so every package's
    `vitest run` actually executed rather than replaying a cached log) to
    tally individual tests directly rather than trusting the brief's
    estimate: `@qualroteiro/geo` 20, `@qualroteiro/fuel` 11,
    `@qualroteiro/routing` 6, `@qualroteiro/tolls` 67, `@qualroteiro/api` 34,
    `@qualroteiro/web` 65 — **203 tests, all passing** (the brief's "~250+"
    estimate was in the right ballpark but not exact; reporting the verified
    figure rather than the estimate).
- **Scope check**: `git diff --name-only origin/dev..HEAD` →
  `.github/workflows/ci.yml`, `README.md`,
  `specs/002-ci-github-actions/{spec.md,tasks.md}`. No `apps/*`,
  `packages/*`, `turbo.json`, `tsconfig.base.json`, root `package.json`
  scripts, or `pnpm-lock.yaml` touched.

## What was left out

- The workflow was not run on an actual GitHub Actions runner — verification
  is the equivalent local sequence only (see spec Limits). It will run for
  real on the first push of this branch / PR against `dev`.
- No `actionlint` pass — not installed on this machine; YAML syntax validity
  was confirmed instead.
- `pnpm/action-setup@v4`'s `packageManager`-field auto-detection is
  documented action behavior, not independently re-implemented or verified
  outside of a live runner.
- No Vercel remote-cache wiring (`TURBO_TOKEN`/`TURBO_TEAM`) — no such
  secret exists for this repo; only the local filesystem cache (redirected
  via `TURBO_CACHE_DIR` + `actions/cache@v4`) is used.
