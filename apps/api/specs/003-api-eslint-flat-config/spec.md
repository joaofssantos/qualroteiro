# sdd-lite — `apps/api` ESLint flat config (CI prerequisite)

**Journey**: `j-20260910-hq` (WAVE 1)
**Unit**: `qualroteiro/api`
**Scope**: `apps/api` only. No `apps/web`, `packages/**`, `turbo.json`,
`tsconfig.base.json`, root `package.json`, `pnpm-workspace.yaml` edits (a
`pnpm-lock.yaml` change from adding devDependencies is expected and allowed).
**SDD route**: `aipe skill match --task-type chore --size small` → `sdd=sdd-lite`
(task type "chore" is on spec-kit's skip list → the light sdd-lite floor).

---

## Problem

On a clean checkout of `dev`, `pnpm -w lint` fails. `apps/api/package.json` has
`"lint": "eslint src"` but no `eslint.config.js` and no `eslint` devDependency.
ESLint 9 (hoisted from `apps/web`, which already has a working flat config) has
no config to find for `apps/api` and aborts with exit 2 (flat-config-required
error). `build`/`typecheck`/`test` all pass; only `lint` is broken. This blocks
adding CI, since a green pipeline needs `pnpm -w lint` to pass for every package
that declares the script.

`apps/web/eslint.config.js` already solved the identical problem for itself
(see `apps/web/specs/*` / commit history): a flat config built with
`typescript-eslint`, `js.configs.recommended` + `...tseslint.configs.recommended`,
plus `eslint`, `@eslint/js`, `typescript-eslint`, `globals` pinned as
devDependencies.

## Scope

**In**

- `apps/api/eslint.config.js` — new flat config, same shape as
  `apps/web/eslint.config.js` minus the React-specific plugins
  (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`), since
  `apps/api` is a Fastify/Node backend, not a React app:
  - `ignores: ['dist', 'coverage']`
  - `js.configs.recommended` + `...tseslint.configs.recommended`
  - `languageOptions`: `ecmaVersion: 2022`, `sourceType: 'module'` (this
    package is ESM — `"type": "module"` in `apps/api/package.json`),
    `globals: { ...globals.node, ...globals.es2022 }` (Node globals, not
    browser — this runs server-side).
  - Same `@typescript-eslint/no-unused-vars` argsIgnorePattern/varsIgnorePattern
    `^_` convention as `apps/web`, so a deliberately-unused callback arg can be
    prefixed `_` instead of triggering the rule.
- `apps/api/package.json` devDependencies: `eslint ^9.12.0`, `@eslint/js
  ^9.12.0`, `typescript-eslint ^8.8.1`, `globals ^15.11.0` — pinned to the
  exact versions `apps/web` already uses, so both packages resolve the same
  ESLint major/minor and avoid a second flat-config dialect in the workspace.
- `pnpm-lock.yaml` delta from `pnpm install` picking up the new devDeps.
- Whatever `eslint src` flags in `apps/api/src`, fixed only if trivially safe
  (unused imports, `prefer-const`, etc. — no behavior change). Anything that
  would require a real logic change gets a scoped inline
  `// eslint-disable-next-line <rule> -- <reason>` instead of a behavior
  change, or is reported back rather than guessed at.

**Out**

- Any change to `apps/web`, `packages/**`, `turbo.json`, `tsconfig.base.json`,
  root `package.json`, `pnpm-workspace.yaml`.
- Adding a CI workflow file itself — this unit only makes `pnpm -w lint` pass;
  wiring CI is a separate unit in the journey.
- Any React-specific ESLint plugin — not applicable to this Node package.
- Any runtime/behavior change to `apps/api/src` — `typecheck` and `test` (34
  tests) must stay green and unchanged in meaning.

## Decisions / assumed contracts

1. **Same major/minor as `apps/web`** — pinning `eslint`, `@eslint/js`,
   `typescript-eslint`, `globals` to the identical semver ranges `apps/web`
   already carries avoids the workspace resolving two different ESLint 9
   minors under pnpm's node_modules hoisting, which is what caused the
   original failure (an unconfigured `apps/api` picking up `apps/web`'s
   hoisted `eslint` binary with no config of its own).
2. **`globals.node`, not `globals.browser`** — `apps/api` is a Fastify server;
   its code runs under Node, never in a browser. Using `globals.node` is the
   correct globals set (`process`, `Buffer`, etc.) and mirrors how
   `apps/web/eslint.config.js` scopes `globals.node` onto its own test files.
3. **No React plugins** — `eslint-plugin-react-hooks` and
   `eslint-plugin-react-refresh` are React/Vite-specific and have nothing to
   lint in a backend package; omitted entirely rather than installed unused.
4. **`sourceType: 'module'`** — `apps/api/package.json` declares `"type":
   "module"`, so the flat config's default ESM parsing is correct and made
   explicit rather than left implicit.
5. **Lint findings get the safe fix or a scoped disable, never a silent global
   rule turn-off** — per the brief, any rule that would need a real logic
   change to satisfy is disabled only at its exact call site, with an inline
   comment saying why, not disabled for the whole file/config.

## Acceptance (observable)

- `pnpm --filter @qualroteiro/api lint` → exit 0.
- `pnpm --filter @qualroteiro/api typecheck` → exit 0 (unchanged).
- `pnpm --filter @qualroteiro/api test` → exit 0, 34 tests (unchanged count and
  behavior).
- `pnpm -w lint` → green for both packages that declare a `lint` script today
  (`apps/web`, `apps/api`); `packages/*` have no `lint` script, which is
  expected and out of scope.
- `git diff --name-only origin/dev..HEAD` shows only `apps/api/**` +
  `pnpm-lock.yaml`.
- No lint rule silenced globally without an inline comment justifying it at
  the point it's used.

## Limits (`/state-the-limit`)

- This unit does not add a CI workflow file — it only makes the prerequisite
  (`pnpm -w lint` passing) true. Wiring the pipeline itself is a separate
  journey unit.
- Pinning to `apps/web`'s exact ESLint devDep versions means this config will
  drift together with (and only be revisited alongside) `apps/web`'s; no
  independent version policy was set for `apps/api`.
- If `eslint src` flags real logic concerns beyond trivially-safe fixes, this
  unit disables those specific rules inline with a reasoning comment rather
  than changing behavior — those are called out explicitly in the task doc,
  not fixed by guessing at intent.
