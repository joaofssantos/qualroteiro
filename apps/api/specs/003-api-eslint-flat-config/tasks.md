# Task doc — `apps/api` ESLint flat config

Filled in as the work lands (sdd-lite §3). What changed, how it was verified,
what was left out.

## What changed

| File | Change |
|---|---|
| `apps/api/eslint.config.js` | New. Flat config mirroring `apps/web/eslint.config.js`: `ignores: ['dist', 'coverage']`, `js.configs.recommended` + `...tseslint.configs.recommended`, `languageOptions` (`ecmaVersion: 2022`, `sourceType: 'module'`, `globals.node` + `globals.es2022`), and the same `@typescript-eslint/no-unused-vars` `^_` ignore-pattern convention. No React plugins (not applicable to a Fastify/Node backend). |
| `apps/api/package.json` | Adds devDependencies pinned to the same versions `apps/web` already uses: `eslint ^9.12.0`, `@eslint/js ^9.12.0`, `typescript-eslint ^8.8.1`, `globals ^15.11.0`. |
| `pnpm-lock.yaml` | `apps/api` importer gains the 4 new devDep entries (all already resolved/hoisted from `apps/web`, so no new packages downloaded). |

No changes to `src/**` were needed — `eslint src` reported zero findings against
the new config, so no trivially-safe fixes or scoped rule disables were
required.

## How it was verified

From the worktree root
(`/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/.worktrees/j-20260910-hq-api--pete-campbell`):

- `pnpm install` — resolves the 4 new devDeps for `apps/api` from the
  workspace's existing pnpm store (already hoisted via `apps/web`); lockfile
  delta is a 12-line addition, no other importer touched.
- `pnpm --filter @qualroteiro/api lint` → `eslint src`, exit 0, no output (no
  findings).
- `pnpm -w build` (`turbo run build`) — needed once on a clean checkout so the
  `@qualroteiro/{geo,routing,tolls,fuel}` workspace packages have a `dist/` to
  resolve against; all 6 packages built (5 turbo cache hits + 1 fresh
  `@qualroteiro/api` build), exit 0.
- `pnpm --filter @qualroteiro/api typecheck` → `tsc -p tsconfig.test.json`,
  exit 0.
- `pnpm --filter @qualroteiro/api test` → `vitest run`, **34 tests passed**
  (`env.test.ts` 3, `providers.test.ts` 10, `places.test.ts` 5, `plan.test.ts`
  16), exit 0. Same count as before this change — no behavior touched.
- `pnpm -w lint` (`turbo run lint`) → both `@qualroteiro/web:lint` and
  `@qualroteiro/api:lint` succeed, `2 successful, 2 total`, exit 0.
- `git diff --name-only origin/dev..HEAD` → only
  `apps/api/eslint.config.js` (new), `apps/api/package.json`,
  `apps/api/specs/003-api-eslint-flat-config/{spec.md,tasks.md}`, and
  `pnpm-lock.yaml`. No `apps/web`, `packages/**`, `turbo.json`,
  `tsconfig.base.json`, root `package.json`, or `pnpm-workspace.yaml` touched.

## What was left out

- No CI workflow file — see spec Limits.
- No `src/**` edits — the new lint config produced zero findings, so there was
  nothing to fix or disable inline.
