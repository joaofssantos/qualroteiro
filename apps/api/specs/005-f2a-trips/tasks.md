# Task doc — F2a A2: trips persistence, Clerk auth, `/trips*`

Filled in as the work landed. What changed, how it was verified, what was
deliberately left out, and what is **not** verified.

## What changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | `previewFeatures = ["postgresqlExtensions"]` (D-511, fixes a pre-existing `prisma validate` failure) + the `Trip`/`TripDay`/`TripItem` models, cascades and indexes. |
| `prisma/migrations/20260915000000_f2a_trips/migration.sql` | The DDL, **generated offline and never applied** — see Limits. |
| `src/errors.ts` | `UnauthorizedError` (→ 401), `NotFoundError` (→ 404). |
| `src/app.ts` | Maps the two new errors; `auth`/`trips` added to `AppDeps` as an all-or-nothing pair; `decorateRequest('authUserId', null)`. |
| `src/auth/verifier.ts` | The `AuthVerifier` port, `extractBearerToken`, `requireUserId`, and the `FastifyRequest.authUserId` declaration. |
| `src/auth/clerk.ts` | The Clerk adapter — the only module importing `@clerk/backend`. |
| `src/store/trips.ts` | The `TripStore` port and its DTOs. |
| `src/store/prisma-trips.ts` | The Prisma adapter. **Typecheck-verified only** — see Limits. |
| `src/http/trips-validate.ts` | Request parsing; where D-501…D-504 and D-512 become policy. |
| `src/routes/trips.ts` | The eight endpoints, inside one encapsulated auth scope. |
| `src/env.ts` | `readClerkEnv` — fails at startup if `CLERK_SECRET_KEY` is absent. |
| `src/server.ts` | Wires `PrismaClient` + the Clerk verifier; `onClose` disconnects the pool. |
| `.env.example` | Documents `CLERK_SECRET_KEY` with a placeholder. |
| `package.json` | `+@clerk/backend`, `+@qualroteiro/trips` (`workspace:*`). |
| `tests/trips.test.ts` | 59 tests across AC-1 … AC-16. |
| `tests/helpers/trip-fakes.ts` | In-memory `TripStore` + fake `AuthVerifier`. |
| `tests/env.test.ts` | 5 tests for `readClerkEnv`. |

## The four rules A1 left open — decided

`packages/trips/README.md` refused to invent these, so that they would not
"silently become API policy that `apps/api`'s schema must match". Full
reasoning in [`plan.md`](./plan.md); the short version:

| Rule | Decision |
|---|---|
| D-501 title max length | **200 chars** after `trim()`, matching `@db.VarChar(200)`. |
| D-502 `moduleId` allow-list | **None.** Free-form, capped at 64 chars. An allow-list would make `apps/api` a blocking dependency of every future F2b–d module. |
| D-503 day date within trip range | **Not enforced.** The trip's dates are mutable via `PATCH`, so the containment is not an invariant this API can actually hold; enforcing it at insert only would assert a guarantee that does not exist. |
| D-504 `costEstimate` sign | **Any finite number**, negative included (a refund is a real budget line). `NaN`/`Infinity` rejected. |

One more the package did not raise: **D-512 — `payload` is required and may not
be `null`.** The column is non-nullable and §3 calls it "o resultado salvo do
módulo"; an item carrying nothing is a card that renders empty forever. Any
other JSON value is accepted — only the owning module can judge the shape.

## Verification

Run from the worktree root, all green:

```
pnpm install
pnpm turbo run build --filter=@qualroteiro/api...
pnpm --filter @qualroteiro/api lint        # eslint src — clean
pnpm --filter @qualroteiro/api typecheck   # tsc -p tsconfig.test.json — clean
pnpm --filter @qualroteiro/api test        # 102 passed (5 files), 59 new
pnpm --filter @qualroteiro/api build       # tsc — clean
```

Schema, with no database (Docker unreachable):

```
DATABASE_URL=postgresql://…  pnpm exec prisma validate   # "The schema … is valid 🚀"
DATABASE_URL=postgresql://…  pnpm exec prisma format     # "Formatted … 🚀"
pnpm exec prisma generate                                # client generated
```

`prisma validate` needs *some* `DATABASE_URL` to be set because the datasource
interpolates it; it opens no connection. This machine's `apps/api/.env` carries
only the ORS and Clerk keys, so the value above was supplied inline.

### The tests were checked for teeth

All 59 passed on first run, so six mutations were applied to confirm they are
not vacuous. Each was reverted and the suite re-run green afterwards:

| Mutation | Result |
|---|---|
| ownership filter dropped from the store | **3 failed** |
| auth `preHandler` replaced with a hardcoded user | **6 failed** |
| day↔trip linkage dropped (both call sites) | **1 failed** |
| `PATCH` judged without the stored counterpart date | **1 failed** |
| `costEstimate` finiteness check removed | **1 failed** |
| title length cap removed | **1 failed** |
| `payload` null check removed | **2 failed** |

## Limits

**1. No migration has ever been applied to a real database.** `docker compose
-f ../../infra/docker-compose.yml up -d postgres` failed — "Cannot connect to
the Docker daemon at unix:///Users/…/docker.sock" — on every attempt, so
`prisma migrate dev` never ran. `prisma/migrations/20260915000000_f2a_trips/`
was produced by `prisma migrate diff --from-empty --to-schema-datamodel`, which
is the tool's own output but is **unverified against a live PostgreSQL**. The
file says so in its header. Nobody should read its presence as evidence the
migration works.

**2. `src/store/prisma-trips.ts` has never executed a query.** It is verified
by `tsc` against the generated client's types and by nothing else. Prisma's
types catch a misspelled field or a bad relation filter, but they do not catch
a wrong `orderBy`, a `_max` aggregate over an empty set behaving other than
expected, or a cascade that does not fire. **This is the first thing to
exercise when a database is available.** The integration tests prove the
handlers, the validation, the error mapping and the auth scope — they run
against the in-memory store, so they prove nothing about the adapter.

**3. The ownership guarantee is verified at two of its three levels.** The
port's signature forces every call to name a `userId` (so the filter cannot be
forgotten at a call site), and the tests prove the handlers pass the *verified*
id and turn a `null` into an identical `404`. That the **Prisma** adapter's
`where` clauses actually filter correctly is, per limit 2, typecheck-verified
only. The in-memory store's own filtering is test-verified, but it is a test
double — its correctness is not the production adapter's correctness.

**4. Clerk's verification path is never executed.** `src/auth/clerk.ts` has no
test: every test injects a fake verifier. So the token→`userId` mapping, the
JWKS check and Clerk's error shapes are unexercised. Deliberate — testing them
needs the real secret and a network call, and keeping that module test-free is
what keeps `CLERK_SECRET_KEY` out of every fixture and out of the repository.
The first real sign-in from `apps/web` (A3) is what will exercise it.

**5. `GET /trips` has no pagination.** §3 defines none and returns a bare
array. Fine for a user with tens of trips, wrong for one with thousands; the
`userId` index is in place for when it needs adding.

**6. `lint` covers `src` only**, not `tests` — the pre-existing `eslint src`
script, left as found.

## Not done, on purpose

Reordering endpoints, budget aggregation, and a local `User` table — all out of
scope per [`spec.md`](./spec.md). No file outside `apps/api/` was touched.
