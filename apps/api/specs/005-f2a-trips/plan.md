# Implementation Plan: F2a A2 — Trips persistence, auth and endpoints

**Spec**: [`spec.md`](./spec.md)
**Unit**: `qualroteiro/api` · **Journey**: `j-20260915-kt` · **Wave**: 2

---

## Summary

Add three Prisma models, one auth port, one persistence port, and eight route
handlers. Reuse `@qualroteiro/trips`'s validators rather than re-deriving the
rules, and decide the four policy questions it deliberately left open. Keep the
existing `buildApp(deps)` injection seam as the only way handlers reach the
outside world, so the whole `/trips*` surface is testable with no Clerk network
call and no database — which is what makes this deliverable while the Docker
daemon is down.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6+ (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) |
| Runtime | Node ≥ 20, ESM |
| HTTP | Fastify 5 + `@fastify/cors` (present) |
| Test runner | vitest 2.x + `app.inject()` — no port bound, no network |
| Domain deps | `@qualroteiro/trips` (new `workspace:*` dep of this app) |
| New runtime deps | `@clerk/backend` — the only one |
| Persistence | Prisma 5.22 + PostgreSQL; schema written, **migration not applied** (no Docker) |

---

## Key Decisions

### The four rules A1 left to this unit

**D-501 — `title` is capped at 200 characters after `trim()`.**
A column has to be *some* width, and choosing one is exactly what A1 said it
could not do without silently legislating for this unit's schema. 200 is far
past any real trip title ("Litoral Norte com a família, outubro 2026" is 41)
and short enough that the column stays indexable and a runaway paste is
rejected at the edge rather than stored. Enforced in `apps/api`'s own request
parsing, not pushed back into `@qualroteiro/trips` — the package stays
policy-free, which was the point of it refusing. `@db.VarChar(200)` and the
`400` agree by construction.

**D-502 — `moduleId` is free-form: non-empty, capped at 64 characters, no
allow-list.** The four known ids are `rota-custos`, `hospedagem`,
`restaurantes`, `atividades`, and three of those four modules do not exist yet.
An allow-list here would make `apps/api` a blocking dependency of every future
module: F2b could not ship without an API release, and — if the list were a
Postgres enum — a migration too. The list would also be a second, drifting copy
of `apps/web`'s module registry, which is the real source of truth for what a
module id means. Non-emptiness (already asserted by `validateTripItem`) plus a
column width is everything this unit can honestly claim. Same reasoning and the
same cap for `kind`, which §3 explicitly calls "livre por módulo".

**D-503 — `TripDay.date` is *not* constrained to its trip's date range.**
This is the one worth arguing. `Trip.startDate`/`endDate` are optional *and*
mutable through `PATCH /trips/:id`. So enforcing the containment at day-create
would not actually buy the invariant: a later `PATCH` narrowing the range would
have to either reject the edit (blocking a legitimate change because of a day
the user is about to move), cascade-delete the now-outside days (destroying
data to preserve a derived rule), or leave the violation in place. The third is
what any reasonable implementation would do — which means the rule would hold
only for rows that happened to arrive in a particular order, and the API would
be asserting an invariant it does not hold. That is worse than not asserting
it: a consumer could not trust the guarantee anyway, and the check would reject
the legitimate workflow of pencilling in days before fixing the dates.
The trip's dates are a *plan*; the days are its *content*; §3 lets both be
edited independently. Flagging the mismatch is the timeline UI's job.
**Rejected alternative**: enforce at create and re-validate on `PATCH`,
rejecting a narrowing that orphans days. Coherent, but it makes a title-only
`PATCH` fail on unrelated grounds and was not asked for by §3.

**D-504 — `costEstimate` accepts any finite number, including negative, and
`null`.** A refund, a credit, or a shared cost booked against one item is a
real budget line, and the consolidated figure is a sum, so a negative is
meaningful rather than corrupt. What *is* rejected: a non-number, and `NaN` /
`Infinity` — neither survives JSON anyway, so rejecting them costs nothing and
keeps a `Float` column from ever seeing a value Postgres would refuse.

### Architecture

**D-505 — `TripStore` is a port, with a Prisma adapter and an in-memory fake.**
Exactly the WAVE 1 `RoutingProvider`/`GeocodeProvider` pattern (D-101):
handlers depend on the interface, `server.ts` alone constructs the Prisma
implementation. This is what lets the acceptance flow in `spec.md` AC-14 run as
a real integration test with no database — which matters more than usual here,
because no database is reachable. The port is also where the ownership rule
lives (D-508), so it cannot be forgotten in one handler out of eight.
**Rejected alternative**: handlers calling `PrismaClient` directly and tests
using a real Postgres via testcontainers. Fine in principle, untestable here
today, and it would scatter the `userId` filter across eight call sites.

**D-506 — `AuthVerifier` is a port; Clerk is one adapter.**
`verifyBearerToken(token) → { userId }`, throwing `UnauthorizedError`.
`src/auth/clerk.ts` wraps `@clerk/backend`'s `verifyToken` and reads `sub` as
the user id; `server.ts` builds it from `CLERK_SECRET_KEY`. Tests inject a fake
mapping a token string to a user id. No test makes a Clerk network call, and no
test needs a real secret — which is also what keeps the secret out of the test
fixtures, and so out of the diff.

**D-507 — auth is an encapsulated Fastify plugin scope, not a global hook.**
The `/trips*` routes register inside `app.register(async (scoped) => …)` with
the `preHandler` hook attached to `scoped`. Fastify's encapsulation means the
hook cannot leak onto `/routes/plan`, `/places/search` or `/health` — F1 stays
anonymous by construction rather than by a path prefix test in the hook body.
AC-15 guards it anyway.

**D-508 — ownership is a filtered read, never a read-then-compare.**
Every store method takes the `userId` and scopes the query by it, so a
non-owner's request finds nothing and takes the same `404` path as a bad id —
identical status and identical body, satisfying §3's "never reveal existence".
No code path loads another user's row into memory and *then* decides, so there
is no place for the comparison to be omitted or for the row to leak into a log
line.

**D-509 — `order` is server-assigned when omitted.** `POST /trips/:id/days`
takes an optional `order` (§3); when absent it appends — `max(order) + 1`
within that trip, `0` when the trip has no days. The item body in §3 has **no**
`order` field at all, so items always append within their day. A client that
sends an explicit day `order` gets it honoured; duplicates are allowed and
broken by `id` on read, because §3 defines no uniqueness and rejecting a
duplicate would break the obvious "insert between" workflow.

**D-510 — two new named errors, `UnauthorizedError` (→ `401`) and
`NotFoundError` (→ `404`), added to `src/errors.ts`.** The existing taxonomy
maps a class to a status in one place (`app.ts`), and its stated rule is that
anything *not* in the taxonomy is a bug and becomes a `500`. Two more classes
keeps that property; returning bare status codes from handlers would break it.

**D-511 — the pre-existing `prisma validate` failure is fixed here.**
`schema.prisma` declares `extensions = [postgis]` without the
`postgresqlExtensions` preview feature, so `prisma validate` fails on `dev`
today (`P1012`) and always has — meaning `prisma migrate` could never have run.
This unit cannot add a model without fixing it. One line in the `generator`
block; no behaviour change to the existing (empty) relational schema.

---

## Data model

```
Trip ──< TripDay ──< TripItem
```

| Model | Notes |
|---|---|
| `Trip` | `userId String` — the Clerk id, **no local `User` table and no FK**; Clerk is the user store. `@@index([userId])` for "list my trips". Dates as `String?` holding `YYYY-MM-DD`, not `DateTime` — see below. |
| `TripDay` | `tripId` FK `onDelete: Cascade`. `@@index([tripId])` for "days for a trip". `date String?`, `order Int`. |
| `TripItem` | `tripDayId` FK `onDelete: Cascade`. `payload Json`. `costEstimate Float?`. `@@index([tripDayId])`. |

**Why `String?` and not `DateTime` for the dates.** §3 types them
`string | null` as ISO `YYYY-MM-DD`, and `@qualroteiro/trips` compares them
lexicographically — sound precisely because `isIsoDate` rejects anything not
zero-padded. A Postgres `DateTime` column would round-trip through a timestamp
with a timezone, which is how a date-only value silently becomes the previous
day for a user west of UTC. Storing the exact string the contract specifies
removes the conversion entirely. `@db.Date` would also work, but then Prisma
hands back a `Date` object and the handler re-formats it — reintroducing the
timezone question at the boundary the contract was written to avoid.

Cascade is declared on the relation so a `DELETE /trips/:id` is one statement
and cannot leave orphans, rather than a three-step delete the handler could get
wrong or interrupt.

---

## Implementation order (TDD, RED → GREEN per step)

1. Fix `schema.prisma` preview feature (D-511); `prisma validate` green.
2. Add the three models; `prisma validate` + `prisma format` green.
3. `src/errors.ts` — `UnauthorizedError`, `NotFoundError` + `app.ts` mapping.
4. Auth port + fake + the `401` tests (AC-5, AC-6) and the F1 regression (AC-15).
5. `TripStore` port + in-memory fake.
6. `src/http/trips-validate.ts` — request parsing, delegating to
   `@qualroteiro/trips` and adding D-501/502/504. Unit tests first.
7. Routes, one endpoint at a time, test first (AC-1 … AC-14).
8. Prisma adapter for `TripStore` (typecheck-verified; not executed — no DB).
9. `server.ts` wiring + `.env.example` + `CLERK_SECRET_KEY` reading in `env.ts`.
