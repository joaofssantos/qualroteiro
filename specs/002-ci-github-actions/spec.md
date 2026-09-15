# sdd-lite — CI (GitHub Actions)

**Journey**: `j-20260910-hq` (WAVE 2)
**Unit**: `qualroteiro/root`
**Scope**: `.github/` only. No `apps/*`, `packages/*`, `turbo.json`,
`tsconfig.base.json`, root `package.json` scripts, or `pnpm-lock.yaml` edits.
**SDD route**: `aipe skill match --task-type chore --size small` → `sdd=sdd-lite`
(task type "chore" is on spec-kit's skip list → the light sdd-lite floor).

---

## Problem

The monorepo has no CI. Every PR/push to `dev` or `main` should run the same
verification a contributor runs locally — install, build, typecheck, lint,
test — so a broken build/lint/test is caught before merge. The prerequisite
blocker (`apps/api` had no ESLint flat config, so `pnpm -w lint` aborted) was
fixed in Wave 1 (`apps/api/eslint.config.js`, commit `9ef43e0`); this unit
verifies that directly before building the workflow on top of it.

## Scope

**In**

- `.github/workflows/ci.yml` — a single workflow, one job, running the exact
  local verification sequence:
  `pnpm install --frozen-lockfile && pnpm -w build && pnpm -w typecheck && pnpm -w lint && pnpm -w test`.
- Optional CI badge in root `README.md`, only if trivial (a plain markdown
  badge line, no other README changes).

**Out**

- Any change to `apps/*`, `packages/*`, `turbo.json`, `tsconfig.base.json`,
  root `package.json` scripts, or `pnpm-lock.yaml`.
- Secrets, deploy, publish, an OS/Node matrix — none of the pipeline needs
  them (no external service is touched by build/typecheck/lint/test).
- Remote (Vercel) Turborepo caching — no `TURBO_TOKEN`/`TURBO_TEAM` secret
  exists for this repo; only the local filesystem cache is usable in CI.

## Decisions

1. **Triggers** — `pull_request` and `push`, both restricted to
   `branches: [dev, main]`. A `pull_request` run covers PRs opened *against*
   `dev`/`main` regardless of the source branch; a `push` run covers direct
   pushes/merges landing *on* `dev`/`main` (e.g. the merge commit itself).
   Pushes to feature/`aipe/*` branches do not trigger CI directly — they run
   under the `pull_request` trigger once a PR targets `dev` or `main`, which
   is the brief's stated pair and keeps the job count down (no redundant
   double-run of the same commit under both events for a normal PR flow).
2. **Concurrency** — `group: ci-${{ github.ref }}`, `cancel-in-progress: true`,
   so superseded pushes to the same PR/branch don't queue stale runs.
3. **pnpm version pin** — `pnpm/action-setup@v4` with no `version:` input,
   letting it read `packageManager: "pnpm@9.12.0"` from root `package.json`
   (the action's documented auto-detection), rather than hardcoding `9.12.0`
   a second time in the YAML where it could drift from `package.json`.
4. **Node version** — `actions/setup-node@v4`, `node-version: 20`, matching
   `.nvmrc` (`20`) and `package.json`'s `engines.node` (`>=20`). No matrix —
   the brief explicitly excludes one.
5. **Turbo cache** — implemented, not skipped, via `actions/cache@v4`.
   Turborepo's default local cache directory in this environment is outside
   the repo (a machine-global dir under the OS cache home), which is both
   unavailable and pointless to cache on ephemeral GitHub-hosted runners.
   Rather than touch `turbo.json` (out of scope) to set `cacheDir`, the
   workflow sets `TURBO_CACHE_DIR: .turbo-cache` as a **job-level env var**
   (confirmed by local test: `TURBO_CACHE_DIR=<relative-path>` redirects
   turbo's filesystem cache into that relative directory with no config-file
   change) and caches that directory with `actions/cache@v4`, keyed on
   `${{ runner.os }}-turbo-${{ hashFiles('pnpm-lock.yaml') }}`, with a
   `restore-keys` prefix fallback so a lockfile-unchanged run still seeds from
   the nearest prior cache. This is the simplest setup that actually caches:
   one extra step, no new repo files, no secrets.
6. **`pnpm install --frozen-lockfile` failure handling** — if the lockfile
   is out of date, the unit stops and reports `needs-clarification` rather
   than regenerating `pnpm-lock.yaml` (explicit brief instruction; a lockfile
   fix is a separate, wider-scoped change this unit does not own).

## Acceptance (observable)

- `.github/workflows/ci.yml` exists and is valid YAML (verified with
  `python3 -c "import yaml; yaml.safe_load(...)"`, and `actionlint` if
  available on the machine).
- From a clean state, the exact local sequence
  `pnpm install --frozen-lockfile && pnpm -w build && pnpm -w typecheck && pnpm -w lint && pnpm -w test`
  runs green, workflow steps matching 1:1.
- `git diff --name-only origin/dev..HEAD` shows only `.github/**` (+ optional
  `README.md`).

## Limits (`/state-the-limit`)

- The workflow is verified by running its exact step sequence locally in this
  worktree — it is not run on an actual GitHub Actions runner (no push to a
  branch with Actions enabled happened as part of this verification). Runner
  environment differences (network egress, OS package availability, GitHub's
  own pnpm/Node cache behavior) are not exercised here.
- `pnpm/action-setup@v4`'s auto-detection of `packageManager` from
  `package.json` is documented action behavior, not independently verified
  against this exact repo on a live runner.
