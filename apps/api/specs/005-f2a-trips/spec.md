# spec-kit — F2a A2: Trip persistence, Clerk auth, `/trips*` endpoints

**Journey**: `j-20260915-kt` (WAVE 2 — A2)
**Unit**: `qualroteiro/api`
**Scope**: `apps/api` only. No `apps/web`, no `packages/**`, no `turbo.json`,
`tsconfig.base.json`, root `package.json` or `pnpm-workspace.yaml`.
`pnpm-lock.yaml` changes because this unit adds one runtime dependency
(`@clerk/backend`) — unavoidable and in scope.
**SDD route**: `aipe skill match --task-type feature --size medium` →
`sdd=spec-kit` (size medium ≥ the medium threshold → the full
specify → plan → tasks → implement flow).

---

## Problem

F1 ("Rota & Custos") is stateless and anonymous: no user, no database, no
persistence. F2a adds the composition layer — a saved **Trip** made of ordered
**days** holding **items**, where each item is one module's saved result — and
that layer is the first thing in the product that needs both a *user* and a
*database*.

`packages/trips` (A1, merged at `70e4737`) already supplies the frozen domain
types and the pure validators. It deliberately holds no persistence, no Clerk,
and no policy. This unit supplies exactly those three:

1. the Prisma schema that stores `Trip`/`TripDay`/`TripItem`,
2. the Clerk token verification that turns an `Authorization` header into a
   `userId`, and
3. the eight `/trips*` endpoints from `F2-COORDINATION.md` §3.

**The contract is fixed and already being coded against.** `apps/web` (A3,
Codex, outside this journey) was released to build against §3 before this unit
started. The endpoint shapes are therefore not this unit's to redesign; a
needed deviation stops the work and escalates instead.

## The rules A1 refused to invent

`packages/trips/README.md` §"What it deliberately does *not* validate" lists
four rules the A1 dev declined to decide, on the stated grounds that inventing
them in a pure domain package "would silently become API policy that
`apps/api`'s schema must match". This unit is where they become real, because
this unit owns the columns. Each is decided in [`plan.md`](./plan.md) — D-501
(title length), D-502 (`moduleId` allow-list), D-503 (day date within the trip
range), D-504 (`costEstimate` sign).

## Users and their stories

**A signed-in traveller** saves a planned route into a trip, so that the
separate things they looked up in different modules become one itinerary with
one consolidated budget.

- They must see only their own trips. Never another user's, and never even a
  *hint* that another user's trip exists.
- They must be able to keep a trip with no dates at all, and days with no date
  — an unscheduled day is a deliberate value, not a missing one.

**An anonymous visitor** keeps using F1 exactly as before. F2a must not put a
login in front of `/routes/plan`, `/places/search` or `/health`.

## Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | `POST /trips` with a valid body returns `201` and a `Trip` owned by the caller |
| AC-2 | `POST /trips` with an invalid body returns `400 { error }` whose message names the offending field |
| AC-3 | `GET /trips` returns `200 { trips: TripSummary[] }` containing only the caller's trips, each with `dayCount`/`itemCount` |
| AC-4 | `GET /trips/:id` returns `200 { ...Trip, days: (TripDay & { items })[] }`, days ordered, items ordered |
| AC-5 | Any `/trips*` request with no `Authorization` header returns `401 { error }` |
| AC-6 | Any `/trips*` request with an invalid/expired token returns `401 { error }` |
| AC-7 | Reading, patching or deleting **another user's** trip returns `404`, identical in body and status to a nonexistent id |
| AC-8 | `PATCH /trips/:id` updates only the given fields and returns `200 Trip` |
| AC-9 | `DELETE /trips/:id` returns `204`; the trip's days and items go with it |
| AC-10 | `POST /trips/:id/days` returns `201 TripDay`; omitted `order` appends |
| AC-11 | `POST /trips/:id/days/:dayId/items` returns `201 TripItem` with the payload round-tripped intact |
| AC-12 | `DELETE /trips/:id/days/:dayId/items/:itemId` returns `204` |
| AC-13 | A day or item addressed under a trip the caller does not own returns `404` |
| AC-14 | The full flow — create trip → add day → add item → `GET /trips/:id` — returns everything nested |
| AC-15 | F1's `/routes/plan`, `/places/search` and `/health` still answer with no `Authorization` header (regression) |
| AC-16 | Every error body is `{ "error": "..." }` |

## Out of scope

- **The web UI** — A3 (Codex) owns it.
- **F2b/c/d modules** (hospedagem, restaurantes, atividades). This unit stores
  their items the moment they exist, by *not* constraining `moduleId` (D-502),
  but builds none of them.
- **Budget aggregation endpoints.** `costEstimate` is stored and returned;
  summing it is the timeline's job and no endpoint in §3 asks for a total.
- **Reordering endpoints** (`PATCH` on a day's or item's `order`). Not in §3.
- **A local `User` table.** Clerk *is* the user store; `Trip.userId` is a plain
  string column holding the Clerk user id.

## Deliberate limitations

- **The migration is not applied against a real database.** The Docker daemon
  was unreachable in this environment (`docker info` → error), so the schema is
  verified by `prisma validate` and `prisma format` only. See
  [`tasks.md`](./tasks.md) §"Limits".
- **Clerk's own verification is never executed in tests.** It sits behind an
  injected port (D-506); the tests exercise the port, not Clerk's network call.
