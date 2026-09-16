# @qualroteiro/trips

Domain types and pure validation for the **Planejamento de Viagem (F2)**
composition layer.

Pure types and functions only — no network I/O, no HTTP client, no persistence,
no Clerk. Storage, auth and the `/trips*` endpoints live in `apps/api`.

## The model

```
Trip ──< TripDay ──< TripItem
```

- **`Trip`** — a saved plan owned by one Clerk user, optionally dated.
- **`TripDay`** — an ordered bucket. Its `date` may be `null`, meaning a
  deliberately **unscheduled** day, not a missing value.
- **`TripItem`** — one module's saved result placed on a day. `moduleId` says
  which module produced it, `payload` is that module's result (typed
  `unknown` — only the owning module can read it), and `costEstimate` feeds
  the consolidated budget.

That `unknown` payload is the seam that makes the timeline composable: it can
render and sum items without knowing what any module actually produces, so F2b
(hospedagem), F2c (restaurantes) and F2d (atividades) plug in without touching
this package.

## The shapes are frozen

`Trip`, `TripDay` and `TripItem` are transcribed from `F2-COORDINATION.md` §3,
the contract agreed before this package was written. `apps/api` and `apps/web`
are both built against that document.

`tests/contract.test.ts` holds a second copy and asserts mutual assignability,
so a renamed or newly-optional field fails `pnpm typecheck` instead of reaching
the web app at runtime. To change a shape: update `F2-COORDINATION.md` and its
progress log first, then the contract test, then `src/types.ts`.

## Usage

```ts
import { validateTrip, validateTripItem } from '@qualroteiro/trips';

validateTrip({ title: 'Litoral Norte', startDate: '2026-10-01', endDate: '2026-10-05' });
// → { ok: true }

validateTrip({ title: '  ', startDate: '2026-10-05', endDate: '2026-10-01' });
// → { ok: false, errors: [
//      'title: must not be empty',
//      'endDate: must not be before startDate (endDate 2026-10-01 is before startDate 2026-10-05)',
//    ] }
```

## Validation returns, it does not throw

`@qualroteiro/fuel` and `@qualroteiro/tolls` throw `RangeError` on bad input.
This package returns a `ValidationResult` discriminated union instead, on
purpose:

- Those are *computation* functions asserting a precondition — there is no
  useful litre count for a negative distance, so throwing is right. For a
  validator, the verdict **is** the product; an invalid input is the normal
  path.
- Throwing surfaces only the first problem. The consumer answers
  `400 { "error": … }` for a user-submitted form and wants every problem at
  once.

Converting to the house style is one line; the reverse is impossible:

```ts
if (!result.ok) throw new RangeError(result.errors.join('; '));
```

## Rules

| Function | Checks |
|---|---|
| `isIsoDate(value)` | a real calendar date, zero-padded `YYYY-MM-DD`, timezone-independent |
| `validateTripTitle(title)` | non-empty after `trim()` |
| `validateTripDates(start?, end?)` | each given date is a real ISO date; if both given, `start <= end` (equal is fine — a one-day trip) |
| `validateTrip(trip)` | title + dates |
| `validateTripDay(day)` | `order` is a non-negative integer; `date` is a real ISO date or `null` |
| `validateTripItem(item)` | `order` is a non-negative integer; `moduleId`, `kind`, `title` non-empty |

Date comparison is lexicographic on the string, which is sound precisely
because the format rule runs first and rejects anything not zero-padded.

## What it deliberately does *not* validate

- **`Trip.userId`, `createdAt`, `updatedAt`** — Clerk owns the user id format,
  the persistence layer owns the timestamps.
- **`TripItem.payload`** — `unknown` by design; only the owning module can
  judge it.
- **A `moduleId` allow-list** — the set grows with F2b–d, and this package has
  no business knowing the module registry.
- **`title` maximum length** — the contract states no limit; inventing one here
  would silently become API policy that `apps/api`'s schema must match.
- **`TripDay.date` inside its trip's range** — a `TripDay` does not carry its
  `Trip`, so this package cannot check it. `apps/api` can compose
  `validateTripDates` if it wants the rule.
- **`costEstimate` sign** — a negative figure (a refund, a credit) is not
  obviously wrong, and the contract says nothing.
