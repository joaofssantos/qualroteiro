# Implementation Plan: G1 — Google Places busca real + guarda de custo

**Spec**: [`spec.md`](./spec.md)
**Unit**: `qualroteiro/api` · **Journey**: `j-20260916-sw`

---

## Summary

One new provider adapter (Places API (New) — Nearby Search), one new Prisma
model for the persisted monthly counter, one route that ties a
refuse-before-calling circuit breaker to that provider, and one read-only
admin endpoint. Everything follows the WAVE 1 port/adapter shape already
established by `ors-routing.ts` / `ors-geocode.ts` and the F2a `TripStore`
port — a new capability is a new port plus a new adapter, never a handler
calling a vendor SDK directly.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript 5.6+ (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) |
| Runtime | Node ≥ 20, ESM |
| HTTP | Fastify 5 (present) |
| Test runner | vitest 2.x + `app.inject()` — no port bound, no network |
| New runtime deps | **None.** `fetch`/`AbortSignal.timeout` are Node 20 built-ins, same as the ORS adapters. |
| Persistence | Prisma 5.22 + PostgreSQL — one new model, one new migration, **applied against the real local Postgres** (available this session — see `tasks.md` "Verification"). |

---

## Key Decisions

**D-601 — the breaker is a persisted counter read on every request, not an
in-process counter.** An in-memory counter resets on every deploy/restart and
is wrong the instant a second instance runs — this API is stateless by design
everywhere else specifically so it can scale that way. A database read per
request is one extra query, paid on every call regardless of whether the cap
is close, which is the honest cost of a guarantee that must survive a restart
and hold across instances. **Rejected alternative**: Redis counter with TTL.
`REDIS_URL` is already infra this unit could reach, but it would make the
breaker's correctness depend on a second stateful service staying up, and a
Redis outage should not silently turn the breaker off — a Postgres read
failing already surfaces as a loud `500`, which is the right failure mode for
a safety mechanism.

**D-602 — the counter key is `(sku, yearMonth)`, `yearMonth` as `YYYY-MM` UTC
text, not a rolling 30-day window.** Google's own free tier is described as
"free calls per month," and Google Cloud billing resets on the calendar
month — matching that key is what makes `GOOGLE_PLACES_SEARCH_MONTHLY_CAP`
mean what its name says. UTC specifically (not server-local time), so the
rollover happens at the same real-world instant regardless of where the
process runs — see `store/api-usage.ts`'s doc-comment on `currentYearMonth`.
Text, not `DateTime`, for the same reason `Trip.startDate` and
`TripDay.date` are (`specs/005-f2a-trips/plan.md`): it is compared as a whole
calendar-month key, and a timestamp column invites the exact timezone bug
text was chosen to avoid.

**D-603 — `sku` is a free-form string column, not an enum.** Only
`places-nearby-search` exists today, but Place Details and Autocomplete are
separately-priced Google Places operations this unit deliberately does not
build (per `spec.md` "Out of scope") and a future unit adding them should not
need a migration just to add a second SKU string. Same reasoning as F2a's
`TripItem.moduleId` (`specs/005-f2a-trips/plan.md` D-502).

**D-604 — `ApiUsageStore` is a port, with a Prisma adapter and an in-memory
fake — same shape as `TripStore` (F2a D-505).** This is what makes AC-5 (the
breaker's most important property) provable without touching Postgres: the
route test seeds a fake store at the cap and asserts the provider mock's call
count is exactly `0`. The breaker's *logic* — "read the count, compare to the
cap, refuse before calling" — lives in the route handler, not in the store,
so it is exercised the same way whether the store is the fake or the real
Prisma adapter.

**D-605 — increment is a single `upsert` with `count: { increment: 1 }`, never
a read-then-write.** Two concurrent requests in the same month reading the
same count and each computing "+1" independently would under-count real
calls to Google — exactly the failure mode a cost guard cannot have. The
upsert's `create`/`update` pair also means the first call of a new month
needs no separate "does this row exist yet" branch.

**D-606 — the breaker is checked, and can refuse, strictly BEFORE the
provider is invoked; the counter is incremented strictly AFTER the provider
call returns successfully.** Both orderings are structural in
`routes/places-nearby.ts`, not incidental: the cap check happens before
`deps.googlePlaces.searchNearby(...)` is reached at all, and the increment
call is the last statement before building the response, downstream of the
`try/catch` around the provider call. A call the breaker refuses never
reaches the provider (AC-5); a call that fails never reaches the increment
(AC-7, `spec.md`).

**D-607 — `GET /admin/places-usage` is deliberately unauthenticated in this
unit.** `spec.md`'s explicit scope decision: this is operational data (a
count and a cap), not user data — nothing here is bound to a Clerk user the
way `/trips*` is. Adding auth here would either reuse Clerk (giving every
signed-in traveller admin visibility into API cost, which is not what "admin"
should mean) or need a new auth mechanism this unit was not asked to design.
The endpoint's shape does not change if a later unit adds one.

**D-608 — G1's four new `AppDeps` fields (`googlePlaces`, `apiUsage`,
`placesMonthlyCap`) follow the F2a `auth`/`trips` precedent: all three or
none.** Half-wiring — a provider with no cap, or a cap with no store — would
either crash on first request or run an unbounded breaker; `buildApp` refuses
to construct that app at all, at the composition root, the same way F2a's
`auth`/`trips` pairing does (`app.ts`).

**D-609 — `QuotaExceededError` is a new error class (→ `503`), distinct from
`ProviderError` (→ `502`).** The existing taxonomy's stated rule
(`errors.ts`) is that every mapped class means something structurally
different; conflating "we refused to call" with "the call we made failed"
would make `502` mean two different things and make a client unable to tell
"try a different endpoint, ours is capped" from "Google is down, retry
later."

---

## Data model

```
ApiUsageCounter  (sku, yearMonth) UNIQUE
```

| Model | Notes |
|---|---|
| `ApiUsageCounter` | No surrogate `@id` — `@@unique([sku, yearMonth])` is the row's only identifying key, which is all `getCount`/`increment`/`upsert` ever address it by. `count Int @default(0)`. |

---

## Implementation order (TDD, RED → GREEN per step)

1. `prisma/schema.prisma` — `ApiUsageCounter` model; `prisma validate` green.
2. `src/errors.ts` — `QuotaExceededError` + `app.ts` mapping to `503`.
3. `src/env.ts` — `readGooglePlacesEnv` (key required, cap optional/validated,
   defaults to 4500), tests first.
4. `src/providers/google-places.ts` — the Nearby Search adapter against a
   stubbed `fetch`, mirroring `ors-routing.ts`'s test shape: response
   mapping, category→`includedTypes`, field mask, `ProviderError` paths.
5. `src/store/api-usage.ts` (port) + `src/store/prisma-api-usage.ts` (Prisma
   adapter) + `tests/helpers/fakes.ts`'s in-memory `fakeApiUsageStore`.
6. `src/http/validate.ts` — `parseNearbyQuery`, unit-covered via the route's
   `400` tests (AC-3, AC-4).
7. `src/routes/places-nearby.ts` — the breaker + adapter + counter, one
   endpoint, test-first (AC-1, AC-2, AC-5, AC-6, AC-7, AC-9).
8. `src/routes/admin-places-usage.ts` (AC-8).
9. `app.ts` wiring (`AppDeps` + registration + error mapping) and F1/F2a
   regression tests (AC-10).
10. `server.ts` wiring, `.env.example`.
11. Real migration (`prisma migrate deploy` against the local Postgres — see
    `tasks.md`), one real round-trip against the live database, one real
    call to Google Places with the real key from `.env`.
