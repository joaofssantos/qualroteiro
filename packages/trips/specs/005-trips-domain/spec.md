# F2a/A1 — `@qualroteiro/trips` domain types + pure validation

## Problem

F2 introduces a composition layer: a saved **Trip** made of **days**
(`TripDay`) holding **items** (`TripItem`), where each item is a saved result
of some module (`rota-custos` today; `hospedagem`, `restaurantes`,
`atividades` later). Two other units need these shapes to exist:

- `apps/api` (A2) — Prisma schema, Clerk middleware, `/trips*` endpoints.
- `apps/web` (A3) — already being written **right now** against the contract
  published in `F2-COORDINATION.md` §3.

Because A3 is already coding against it, the type contract is **frozen**. This
unit is the shared, dependency-free home for those types plus the validation
rules both sides must agree on, so the rules are not re-implemented (and
re-invented) once in the API and once in the browser.

## Scope

**In:**
- `packages/trips/` — new workspace package `@qualroteiro/trips`, mirroring the
  `packages/tolls` / `packages/fuel` skeleton (`package.json`,
  `tsconfig.json`, `tsconfig.test.json`, `src/`, `tests/`, vitest).
- `src/types.ts` — `Trip`, `TripDay`, `TripItem`, exactly the field names and
  optionality of `F2-COORDINATION.md` §3 (fields marked `readonly`, which is a
  compile-time-only annotation and does not change the wire/JSON shape).
- `src/validate.ts` — pure validation of the three rules below, plus the
  ISO-date predicate they rest on.
- `src/index.ts` — the package's public surface.
- `tests/` — a valid case and an invalid case for every validation function.

**Out:**
- **All I/O.** No Prisma, no DB, no HTTP, no Clerk. This package is types and
  pure functions; the persistence unit is A2 in `apps/api`.
- `apps/api`, `apps/web`, `packages/{geo,routing,tolls,fuel}`, root
  `package.json`, `turbo.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`
  (the workspace glob `packages/*` already picks the new package up, so no root
  edit is needed).
- Any redesign of the frozen type contract.
- `TripSummary` (`Trip` + `dayCount`/`itemCount`): it is an API **response**
  shape, owned by A2, not a domain entity. Not modelled here.

## The frozen contract

Reproduced from `F2-COORDINATION.md` §3 as the single source of truth for this
unit. Deviating from it breaks A3, which is in flight.

```ts
interface Trip     { id, userId, title, startDate: string|null,
                     endDate: string|null, createdAt, updatedAt }
interface TripDay  { id, tripId, date: string|null, order: number }
interface TripItem { id, tripDayId, order: number, moduleId, kind, title,
                     payload: unknown, costEstimate: number|null }
```

## Validation rules

Minimum required by the brief:

1. **`Trip.title`** — non-empty after `trim()`.
2. **`Trip.startDate` / `endDate`** — when **both** are present,
   `startDate <= endDate`.
3. **`TripDay.order` / `TripItem.order`** — non-negative integers.

Added, and why (each is a rule A2 would otherwise have to invent at the HTTP
boundary, and none changes the frozen type shape):

4. **Date format** — any non-null date must be a real calendar date in
   `YYYY-MM-DD`. Rule 2 compares dates **lexicographically**, which is only
   correct for zero-padded `YYYY-MM-DD`; validating the format is what makes
   the cheap comparison honest, so the two rules ship together.
   `2026-02-30` is rejected (well-formed but not a real date).
5. **`TripItem.moduleId` / `kind` / `title`** — non-empty after `trim()`, same
   reasoning as rule 1: an item that names no module cannot be rendered or
   costed.

Deliberately **not** invented here: a max length for `title`, an allow-list of
`moduleId` values, or a rule that `TripDay.date` falls inside its trip's
`startDate`..`endDate`. The first two are constraints A2's schema would have to
match and the contract does not state them; the third needs the parent `Trip`,
which a `TripDay` does not carry. Listing them as out-of-scope rather than
guessing — see `plan.md` for the full rationale.

## Error-signalling decision

`@qualroteiro/fuel` and `@qualroteiro/tolls` **throw `RangeError`** on bad
input. This package **returns a `ValidationResult`** instead, and that
divergence is intentional:

- Those are *computation* functions asserting a precondition they cannot
  proceed without — there is no useful answer for a negative `distanceKm`, so
  throwing is right. A *validator*'s entire product is the verdict; throwing
  makes the normal path an exception.
- Throwing surfaces only the **first** problem. The consumer, A2, answers
  `400 { "error": "..." }` for a user-submitted form and wants every problem at
  once.
- A caller who prefers the house style gets it in one line:
  `if (!r.ok) throw new RangeError(r.errors.join('; '))`. The reverse —
  recovering a list from a thrown error — is not possible.

Shape: a discriminated union, `{ ok: true }` or
`{ ok: false; errors: readonly string[] }`, so TypeScript narrows `errors` and
an `ok` result carries no empty array to check.

## Acceptance

- `pnpm --filter @qualroteiro/trips build`, `typecheck`, `test` all green.
- `pnpm -w build` and `pnpm -w test` show no regression in the other packages.
- Every exported validation function has at least one passing and one failing
  test; rules 1–3 are each covered explicitly.
- A compile-time test asserts the exported types are structurally assignable
  to the frozen contract, so a future edit to a field name fails `typecheck`
  rather than silently breaking A3.
- `git diff --name-only origin/dev..HEAD` touches only `packages/trips/**`.
