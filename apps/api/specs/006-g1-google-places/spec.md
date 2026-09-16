# spec-kit — G1: Google Places busca real + guarda de custo

**Journey**: `j-20260916-sw` (G1)
**Unit**: `qualroteiro/api`
**Scope**: `apps/api` only. No `apps/web`, no `packages/**`, no `turbo.json`,
`tsconfig.base.json`, root `package.json` or `pnpm-workspace.yaml`.
**SDD route**: `aipe skill match --task-type feature --size medium` was run in
this workspace and returned `sdd=none — no SDD kit is installed` (the
toolbox install from an earlier journey is not present on this fresh
`origin/dev` checkout). This artifact set follows the project's established
spec-kit shape anyway — `spec.md` → `plan.md` → `tasks.md` — matching
`apps/api/specs/005-f2a-trips/` (F2a A2), per the coordinator's explicit
instruction to replicate that PR's format regardless of the toolbox gap.

---

## Problem

Hospedagem, Restaurantes and Atividades are meant to replace manual text entry
with real search results. This unit is the foundation for all three: one
backend endpoint, `GET /places/nearby`, that calls Google Places on their
behalf. The UI wiring for any of the three modules is a separate, later
journey — this unit builds and proves the backend alone.

**The non-negotiable requirement is cost, not search quality.** Nearby Search
is priced per call past a 5,000-call/month free tier (US$25.60/1000 after
that), and a backend with no ceiling on outbound calls to a billed API is a
real invoice waiting to happen — from a bug, a scraping client, or an
accidental loop, not just organic traffic. So this unit is really two things
built together: the search endpoint, and a circuit breaker that refuses to
place a call once a configured monthly cap is reached, checked and enforced
**before** the network call — not a log line written after the bill is
already incurred.

## Users and their stories

**A future Hospedagem/Restaurantes/Atividades module** (not built in this
unit) calls `GET /places/nearby` with a coordinate, a category, and gets back
real places instead of whatever a user typed by hand.

**The product owner** needs the guarantee that no bug or traffic spike in any
of those future modules can produce a surprise Google bill — the breaker must
hold regardless of what calls the endpoint.

**An operator** checks `GET /admin/places-usage` to see how close the current
month is to the cap, without needing database access.

## Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | `GET /places/nearby?lat&lng&category` returns `200 { places: PlaceResult[] }`, `PlaceResult = { id, name, address, lat, lng, category }` |
| AC-2 | `category` maps to Google's `includedTypes`: `hospedagem→lodging`, `restaurantes→restaurant`, `atividades→tourist_attraction` |
| AC-3 | Missing/invalid `lat`, `lng`, or `category` outside the enum → `400 { error }` naming the offending field |
| AC-4 | `radiusMeters` is optional, defaults to `3000`, must be positive when present |
| AC-5 | Once the current month's persisted counter for SKU `places-nearby-search` reaches `GOOGLE_PLACES_SEARCH_MONTHLY_CAP` (default 4500), the endpoint returns `503 { error }` **without ever calling Google** — proven by asserting the provider mock's call count is `0`, not merely by the status code |
| AC-6 | A successful call to Google increments the persisted counter by exactly 1, atomically |
| AC-7 | A call that fails before completing (timeout, non-2xx, bad JSON) does **not** increment the counter, and returns `502 { error }` |
| AC-8 | `GET /admin/places-usage` returns `200 { usage: [{ sku, yearMonth, count, cap }] }` reflecting the real persisted counter |
| AC-9 | V1 uses only Nearby Search — no Place Details call is ever made |
| AC-10 | The existing F1/F2a surface (`/routes/plan`, `/places/search`, `/trips*`, `/health`) is unaffected (regression) |

## Out of scope

- **The UI** for Hospedagem/Restaurantes/Atividades. A later journey.
- **Place Details** (a second, separately-priced call per place). Nearby
  Search's own response already carries name, address and coordinates.
- **Google Autocomplete.**
- **Authentication on `GET /admin/places-usage`.** Explicit scope decision:
  this is operational data (how close the breaker is to tripping), not user
  data, and this unit does not add an admin auth boundary. A future unit can
  add one without changing this endpoint's shape.

## Deliberate limitations

- **Only one SKU exists**: `places-nearby-search`. The breaker, the counter
  table and the admin endpoint are all designed to hold more than one SKU
  (Place Details, Autocomplete, …) without a schema change, but no other SKU
  is wired in this unit because no other Google Places call exists yet.
- **The cap is per SKU per calendar month (UTC), not a rolling window.** A
  cap that resets exactly at the start of a UTC month rather than 30 days
  after first use is what "monthly" means to Google's own pricing tiers, so
  it is the natural key — see `plan.md` D-602.
