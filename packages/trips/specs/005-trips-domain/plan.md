# Plan — `@qualroteiro/trips`

## Package skeleton

Copied from `packages/fuel` (the closest match: pure functions, **no workspace
dependencies**, unlike `packages/tolls` which depends on `@qualroteiro/geo`).
`@qualroteiro/trips` needs no dependency either — `payload` is `unknown` on
purpose, so nothing here imports a module's result type.

```
packages/trips/
  package.json          name @qualroteiro/trips, private, type module,
                        main/types/exports/files + build/typecheck/test,
                        devDeps typescript + vitest — identical to fuel
  tsconfig.json         extends ../../tsconfig.base.json, outDir dist, rootDir src
  tsconfig.test.json    extends ./tsconfig.json, rootDir ., noEmit, include src+tests
  README.md             what the package is, and the "no I/O" rule
  src/types.ts          Trip, TripDay, TripItem
  src/validate.ts       ValidationResult + the validators
  src/index.ts          public surface
  tests/validate.test.ts
  tests/contract.test.ts  compile-time assignability to the frozen contract
```

No root-level edit: `pnpm-workspace.yaml` already globs `packages/*`, and
`turbo.json` drives tasks by script name.

## Module split

`types.ts` / `validate.ts` rather than one file, mirroring `tolls`
(`types.ts` + `tariff.ts` + `match.ts`). It also keeps the frozen contract in a
file whose diff is easy to review in isolation — a reviewer can see at a glance
that a PR did not touch the shapes A3 depends on.

## Public surface

```ts
// types
export type { Trip, TripDay, TripItem };

// validation
export type { ValidationResult, TripInput, TripDayInput, TripItemInput };
export {
  isIsoDate,
  validateTripTitle,
  validateTripDates,
  validateTrip,
  validateTripDay,
  validateTripItem,
};
```

### Why `*Input` types and not the entities themselves

The API validates a **draft** before it has an id: `POST /trips` receives
`{ title, startDate?, endDate? }`, and `POST /trips/:id/days` receives
`{ date?, order? }`. A validator typed as `(trip: Trip) => …` would be unusable
there — the caller has no `id`, `createdAt` or `updatedAt` to supply.

So each validator takes a structurally minimal input whose date/order fields
are `?: T | null`. A full `Trip` is assignable to `TripInput` (a required
`string | null` satisfies an optional `string | null`), so the same function
serves both the create path and a check on a loaded entity. Only the fields a
rule actually reads appear in the input type.

### Runtime type checks on statically typed parameters

The validators' real caller is an HTTP boundary, where `JSON.parse` yields
values TypeScript has been *told* are `string` but that may be a number, an
object, or absent. The validators therefore check `typeof` at runtime even
though the parameter is typed. That is not redundancy; the type annotation
documents the intended call, and the runtime check is what makes the function
safe for the only caller that matters. Tests cover this with casts.

## Date handling

`isIsoDate(value: unknown): value is string`:

1. `typeof value === 'string'` and matches `/^\d{4}-\d{2}-\d{2}$/`.
2. Round-trip check for real calendar dates: build
   `new Date(`${value}T00:00:00Z`)` and confirm its UTC year/month/day re-format
   to the same string. This rejects `2026-02-30` and `2026-13-01`, which step 1
   alone accepts.

`T00:00:00Z` (not the bare date string) and the **UTC** getters are both
deliberate: they keep the result independent of the machine's timezone, so the
same input does not validate differently in CI and on a laptop.

Comparison in `validateTripDates` is then plain `startDate > endDate` string
comparison. Valid for zero-padded `YYYY-MM-DD`, cheaper than parsing, and
guarded by the format rule that runs first. Equal dates are **allowed** — a
one-day trip is legitimate.

## Error messages

Plain strings, field-prefixed: `"title: must not be empty"`,
`"endDate: must not be before startDate (2026-10-05 < 2026-10-01)"`. Directly
usable as `{ "error": … }` by A2, readable in a test failure. Not structured
error codes — nothing consumes a code today, and inventing a code vocabulary A2
has not asked for is the kind of guess this plan is trying to avoid.

## Rules deliberately left out

| Candidate rule | Why not |
|---|---|
| `title` max length | A2's schema would have to match a number the contract never states. Prisma `String` is unbounded by default; picking 200 here silently makes it API policy. |
| `moduleId` allow-list | The contract calls `moduleId` open (`'rota-custos' \| 'hospedagem' \| …` is listed as an example, and F2b–d add more). An allow-list here would reject a module the moment it ships, from a package that has no reason to know the module registry. |
| `TripDay.date` within the trip's range | Needs the parent `Trip`, which `TripDay` does not carry. Would require a two-entity validator nobody has asked for; A2 can compose `validateTripDates` if it wants this. |
| `costEstimate >= 0` | Plausible, but a credit/refund item is not obviously invalid, and the contract says nothing. Left to A2. |

## Test plan (TDD, RED first)

`tests/validate.test.ts` — one `describe` per function, each with at least a
valid and an invalid case:

- `isIsoDate` — accepts `2026-10-01`; rejects `2026-2-1`, `2026-02-30`,
  `01/10/2026`, `''`, `null`, a number.
- `validateTripTitle` — accepts `'Litoral Norte'`; rejects `''`, `'   '`, a
  non-string.
- `validateTripDates` — accepts both null, only one present, `start < end`,
  `start === end`; rejects `start > end`, a malformed date on either side.
- `validateTrip` — accepts a full valid `Trip`; rejects one with both a blank
  title and inverted dates, asserting **both** errors come back (this is the
  test that would fail under a throwing design, and is why the return shape was
  chosen).
- `validateTripDay` — accepts `order: 0`; rejects `-1`, `1.5`, `NaN`.
- `validateTripItem` — accepts a full valid item; rejects a negative order and
  a blank `moduleId`.

`tests/contract.test.ts` — type-level only: declares `const t: FrozenTrip =
{} as Trip` (and the same for `TripDay`/`TripItem`) against locally re-typed
copies of the `F2-COORDINATION.md` §3 interfaces, in **both** directions. A
renamed or newly-optional field then fails `pnpm typecheck` instead of reaching
A3 as a runtime surprise.
