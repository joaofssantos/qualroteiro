# Task doc — G1: Google Places busca real + guarda de custo

Filled in as the work landed. What changed, how it was verified, and the one
environment note worth flagging.

## What changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | New `ApiUsageCounter` model (`sku`, `yearMonth`, `count`, `@@unique([sku, yearMonth])`). |
| `prisma/migrations/20260916060000_g1_api_usage_counter/migration.sql` | The DDL for the new table + its unique index — **applied for real** against the local Postgres (see Verification). |
| `prisma/migrations/migration_lock.toml` | Was missing from the repo (a gap left by A2, whose migration was generated but never applied); added here as part of getting a real `prisma migrate deploy` to run. `provider = "postgresql"`, matches the existing datasource. |
| `src/errors.ts` | `QuotaExceededError` (→ `503`) — distinct from `ProviderError` (→ `502`): ours is a refusal, not an upstream failure. |
| `src/app.ts` | Maps `QuotaExceededError`; `googlePlaces`/`apiUsage`/`placesMonthlyCap` added to `AppDeps` as an all-or-nothing triple (same precedent as `auth`/`trips`); registers the two new routes when wired. |
| `src/env.ts` | `readGooglePlacesEnv` — fails at startup if `GOOGLE_PLACES_API_KEY` is absent or `GOOGLE_PLACES_SEARCH_MONTHLY_CAP` is present but not a positive number; defaults the cap to `4500`. |
| `src/providers/google-places.ts` | The Places API (New) Nearby Search adapter — the only module that knows Google's request/response shape. |
| `src/store/api-usage.ts` | `ApiUsageStore` port + `currentYearMonth`. |
| `src/store/prisma-api-usage.ts` | The Prisma adapter — `increment` is one `upsert` with `count: { increment: 1 }`, never read-then-write. |
| `src/http/validate.ts` | `parseNearbyQuery` — `lat`/`lng`/`category` required, `radiusMeters` optional (default `3000`, must be positive). |
| `src/routes/places-nearby.ts` | `GET /places/nearby` — validate → check breaker → call provider → increment → respond. |
| `src/routes/admin-places-usage.ts` | `GET /admin/places-usage` — deliberately unauthenticated (see `spec.md`). |
| `src/server.ts` | Wires the real Google Places provider + Prisma usage store into `buildApp`. |
| `.env.example` | Documents `GOOGLE_PLACES_API_KEY` (required) and `GOOGLE_PLACES_SEARCH_MONTHLY_CAP` (optional, default noted). |
| `tests/google-places.test.ts` | 11 tests — adapter mapping, category→`includedTypes`, field mask, error paths. |
| `tests/places-nearby.test.ts` | 23 tests — `/places/nearby` shape, validation, the breaker, increment/no-increment, `/admin/places-usage`. |
| `tests/env.test.ts` | +8 tests for `readGooglePlacesEnv` (19 total in the file now). |
| `tests/helpers/fakes.ts` | `fakeGooglePlacesProvider`, `failingGooglePlacesProvider`, `fakeApiUsageStore` — the last a real in-memory implementation of the port's semantics, not a stub. |

## One environment note

This session's sandbox placed the work in its own isolated git worktree
(`.claude/worktrees/agent-a6d599cb404331765`, branch
`aipe/j-20260916-sw/api--pete-campbell--impl`) rather than the
`.worktrees/j-20260916-sw-api--pete-campbell` path named in the brief — the
harness's own worktree isolation refused git operations redirected there, and
that branch name was already checked out in that other worktree. The working
tree's starting point is content-identical to `origin/dev` (`git diff
--name-only origin/dev..HEAD` was empty before this unit's changes), so
nothing about the branch history differs from what "reset on top of
origin/dev" describes — only the on-disk path and the exact branch name do.
Flagging this for the coordinator to reconcile (rename/fast-forward the
intended branch, or take this one directly) rather than resolving it
unilaterally.

`.env` was copied byte-for-byte from `.worktrees/j-20260916-sw-api--pete-campbell/apps/api/.env`
into this worktree via `cp` — its contents were never read, printed, or
logged at any point in this session.

## Verification

Run from this worktree's `apps/api`, all green:

```
pnpm --filter @qualroteiro/api typecheck   # tsc -p tsconfig.test.json — clean
pnpm --filter @qualroteiro/api lint        # eslint src — clean
pnpm --filter @qualroteiro/api test        # 152 passed (7 files) — 34 new tests in 2 new files, +8 in env.test.ts
pnpm turbo run build --filter=@qualroteiro/api...   # 6/6 tasks succeeded
```

### The circuit breaker test was checked for teeth

The most important test in this unit — "refuses with 503 WITHOUT ever calling
the provider once the monthly cap is reached" — was proven non-vacuous by two
mutations, each reverted and the suite re-run green afterward:

| Mutation | Result |
|---|---|
| the cap check (`if (count >= deps.monthlyCap)`) short-circuited to never trip | breaker test **failed**: `expected 200 to be 503` |
| the counter increment moved to BEFORE the provider call instead of after | "does NOT increment on failure" test **failed**: `expected 4 to be 3` |

### Real Postgres — schema and migration

The local Postgres (`postgis/postgis:16-3.4`, `localhost:5433`, matching this
worktree's `.env`) was reachable this session, unlike during A2. A real
migration was generated and applied — not merely `prisma validate`:

```
$ pnpm exec prisma migrate deploy
Datasource "db": PostgreSQL database "qualroteiro", schema "public" at "localhost:5433"
2 migrations found in prisma/migrations
Applying migration `20260916060000_g1_api_usage_counter`
All migrations have been successfully applied.

$ pnpm exec prisma migrate status
Database schema is up to date!

$ pnpm exec prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

(The pre-existing F2a `20260915000000_f2a_trips` migration was already
applied to this database from an earlier session — `migrate status` reported
it up to date before this unit's migration was generated. This unit only
added its own migration on top.)

A real round-trip against the live database, through `createPrismaApiUsageStore`
(temporary script, deleted after running, using a throwaway `*-verify` SKU
cleaned up at the end):

```
count before: 0
after 1st increment: { sku: 'places-nearby-search-verify', yearMonth: '2026-09', count: 1 }
after 2nd increment: { sku: 'places-nearby-search-verify', yearMonth: '2026-09', count: 2 }
listAll (filtered to verify sku): [ { sku: '...-verify', yearMonth: '2026-09', count: 2 } ]
cleanup done
```

### Real Google Places — evidence, not a mock

One real call was made against Google's live Places API (New) using the real
`GOOGLE_PLACES_API_KEY` from `.env`, loaded the same way `server.ts` loads it
(`loadDotEnvInto` + `readGooglePlacesEnv`). **The key itself was never
printed, logged, or included in any output at any point.**

Adapter-level call (São Paulo, Av. Paulista area, `restaurantes`):

```
REAL Google Places call succeeded.
result count: 20
sample (name/address/category only, no key): [
  { name: 'Méqui 1000', address: 'Av. Paulista, 1811 - Bela Vista, São Paulo - SP, 01311-200, Brazil', category: 'restaurantes' },
  { name: 'Padaria Bella Paulista', address: 'Rua Haddock Lobo, 354 - Cerqueira César, São Paulo - SP, 01414-000, Brazil', category: 'restaurantes' },
  { name: 'Rosewood São Paulo', address: 'R. Itapeva, 435 - Bela Vista, São Paulo - SP, 01332-000, Brazil', category: 'restaurantes' }
]
```

Full end-to-end (real `buildApp`, real Prisma, real Google, through
`app.inject` — no mocks anywhere in this run), `category=hospedagem`:

```
GET /places/nearby status: 200
places returned: 20
sample: [
  { name: 'Rosewood São Paulo', address: 'R. Itapeva, 435 - Bela Vista, São Paulo - SP, 01332-000, Brazil' },
  { name: 'Renaissance Sao Paulo Hotel', address: 'Alameda Santos, 2233 - Jardim Paulista, São Paulo - SP, 01419-002, Brazil' }
]
GET /admin/places-usage status: 200
usage body: { usage: [ { sku: 'places-nearby-search', yearMonth: '2026-09', count: 1, cap: 4500 } ] }
```

That `count: 1` is the real, persisted result of the one real call above —
left in place deliberately as genuine evidence of real usage (unlike the
`-verify` SKU used for the store round-trip, this is the actual
`places-nearby-search` SKU the production endpoint uses, and incrementing it
once is exactly the behaviour being verified).

Both verification scripts were temporary files under `apps/api/.tmp-verify/`,
deleted immediately after running — nothing under that path is part of this
commit.

## Design decisions within scope

- **`lat`/`lng` validation** reuses the same numeric-range rules as the
  existing `origin`/`destination` coordinate validation in
  `http/validate.ts` (`-90..90`, `-180..180`), for consistency with the rest
  of the API. Fastify hands query params back as strings, so
  `parseNumberParam` explicitly rejects blank/missing before calling
  `Number(...)` — `Number('')` is `0`, not `NaN`, which would otherwise let
  an empty `lat=` silently parse as the equator.
- **Error messages name the field exactly**: `"lat is required and must be a
  number"`, `"lat must be between -90 and 90, got 999"`,
  `"category must be one of: hospedagem, restaurantes, atividades"`,
  `"radiusMeters must be a positive number, got 0"`.
- **The breaker's refusal message** names the SKU, the cap, and the month,
  and says explicitly that no request was sent — useful both for a human
  reading logs and for `spec.md`'s own AC-5 wording: `"monthly cap of 4500
  calls reached for 'places-nearby-search' (2026-09); no request was sent to
  Google Places"`.
- **`GET /admin/places-usage`'s `cap` field** is looked up from a
  `Record<string, number>` the route is handed (`{ [sku]: monthlyCap }`),
  not hardcoded — a future second SKU with its own cap only needs a second
  entry in that map, not a code change to the route.

## Not done, on purpose

Place Details, Google Autocomplete, admin authentication, and any UI wiring
for Hospedagem/Restaurantes/Atividades — all out of scope per
[`spec.md`](./spec.md). No file outside `apps/api/` was touched.
