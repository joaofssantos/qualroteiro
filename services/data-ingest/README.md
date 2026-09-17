# @qualroteiro/data-ingest

Background ingestion jobs that populate real-world data into `apps/api`'s
Postgres database.

## `ingest-toll-plazas` (Wave 3 of journey `j-20260916-9y`)

Downloads ANTT's official, monthly toll-plaza CSV, parses it, and upserts it
into `apps/api`'s `TollPlazaRecord` table.

- **Source**: the CSV resource of
  `dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d`
  ("Praça de Pedágio"), fixed URL in `src/download.ts`
  (`ANTT_TOLL_PLAZA_CSV_URL`). Chosen over the dataset's JSON resource
  because the coordinator had already inspected and specified the CSV's
  exact columns; no reason to add a second format to support.
- **Encoding**: the file is ISO-8859-1 (Windows-1252), NOT UTF-8 — confirmed
  by downloading and inspecting the real file. See `src/decode.ts`.
- **Filter**: only rows with `situacao === 'Ativo'` are upserted. Everything
  else is counted as `inactiveSkipped` in the run's structured log and
  otherwise dropped — see the **known limitation** below.
- **Natural key** (`TollPlazaRecord.id`): a slug of
  `concessionaire + plaza name + highway + km`, algorithm documented in full
  in `src/slug.ts`'s doc-comment (NFKD-normalize, strip diacritics,
  lowercase, collapse non-alphanumeric runs to `-`, trim). Verified unique
  across all 277 real rows in the September-2026 CSV.
- **lat/lng**: `latitude` -> `lat`, `longitude` -> `lng`, same axis, never
  swapped — see `tests/antt-csv.test.ts`'s "CRITICAL" test, which asserts
  this against the real "Conselheiro Josino" row
  (`latitude=-21.552594, longitude=-41.331597`).
- **Idempotent**: `prisma.tollPlazaRecord.upsert` keyed on the natural-key
  `id`. Running the job twice against the same CSV updates the same rows
  (bumping `ingestedAt`) rather than creating duplicates — proved in
  `tests/ingest.test.ts` with a fake Prisma client, and (when Postgres was
  locally available) against the real database — see the job's own summary
  for whether that real run happened in a given environment.
- **Prisma schema**: this package does NOT define its own — see
  `src/prisma-client.ts`'s doc-comment for exactly how
  `prisma generate --schema=../../apps/api/prisma/schema.prisma` is wired.

### Known limitation

The real ANTT CSV (checked 2026-09-16) has **zero** inactive rows — all 277
are `Ativo`. Because this job only ever upserts rows currently read as
`Ativo` (see "Filter" above), a plaza that *becomes* inactive in some future
monthly CSV is simply skipped by that run rather than being written with
`active: false` — its existing DB row is left stale (`active: true`) instead
of being flipped. Low blast radius today (nothing to trigger it yet); worth
revisiting if/when ANTT's dataset actually starts carrying inactive rows.

### Running it

```sh
# On-demand / initial seed / manual testing — no Redis needed:
pnpm --filter @qualroteiro/data-ingest ingest:once

# Long-running worker: registers the monthly BullMQ repeatable schedule
# (1st of every month, 06:00 UTC) and processes it when it fires. Needs
# REDIS_URL.
pnpm --filter @qualroteiro/data-ingest worker
```

Both need `DATABASE_URL` (see `.env.example`, same value as `apps/api`'s).

## `ingest-toll-plazas-osm` (Wave 3 of journey `j-20260916-y9`)

Queries the Overpass API for every `barrier=toll_booth` node in Brazil,
clusters same-operator nodes within 150m into plaza candidates
(`clusterTollBooths`, `@qualroteiro/tolls`, Wave 1), parses each cluster's
`charge` tag into a real tariff (`parseOsmCharge`, same package), and upserts
each as a `TollPlazaRecord` with `source: 'osm'` — a second, independent
source that coexists with (never overwrites) the `antt` rows above.

- **Source**: `https://overpass-api.de/api/interpreter`, `POST`, no API key.
  Query scoped to Brazil's real OSM administrative area
  (`area["ISO3166-1"="BR"][admin_level=2]`), not a manual bounding box — see
  `src/overpass.ts`.
- **Real volume, checked live** (2026-09-17): **957** `barrier=toll_booth`
  nodes nationwide — well under orientation.md's "poucos milhares" estimate,
  comfortably inside one `[timeout:180]` request, no pagination needed.
- **Fair use**: a real `User-Agent`, a bounded server-side timeout, a
  client-side `AbortController`, exactly one request per run, no retry loop.
  Overpass's real "server busy" failure (an HTML page, not JSON) is surfaced
  as a distinct thrown error, not silently retried or truncated around.
- **Cluster ≠ node**: one OSM node is one lane; `clusterTollBooths` groups
  same-operator nodes within 150m into one plaza. The natural key is
  `osm-<smallest node id in the cluster>` — stable across re-runs.
- **Best-effort fields**: real OSM toll-booth nodes rarely carry the tags
  ANTT's dataset always has (`highway`/`uf`/`municipality` — see
  `src/osm-toll-plazas.ts`'s doc-comment for the exact real tag-coverage
  numbers). Missing values get an explicit sentinel (`uf: 'BR'`, never a
  real UF code; `"Não informado (OSM)"` for highway/municipality) rather than
  a guess. `lat`/`lng`/`tariff`/`concessionaire` are this job's real accuracy
  promise.
- **Idempotent**: same natural-key `upsert` pattern as the ANTT job —
  verified against the real database (see "Evidence" in
  `specs/002-t5-wave3-osm-toll-ingest/plan.md`): two real runs against the
  live Overpass API produced the same 489 rows both times, with the
  277 pre-existing `antt` rows untouched throughout.

### Running it

```sh
# On-demand / manual testing — no Redis needed:
pnpm --filter @qualroteiro/data-ingest ingest:osm:once

# Same long-running `worker` command above also registers this job's
# monthly repeatable schedule (2nd of every month, 06:00 UTC — one day
# after the ANTT job, so the two don't land on the same worker tick) and
# processes it alongside the ANTT job in the one shared BullMQ queue.
```

## Scripts

- `build` — `tsc -p tsconfig.json`
- `lint` — `eslint src`
- `typecheck` — `tsc -p tsconfig.test.json`
- `test` — `vitest run`
- `prisma:generate` (also runs on `postinstall`) — `prisma generate --schema=../../apps/api/prisma/schema.prisma`
- `ingest:once` — one-off run of `ingest-toll-plazas` (ANTT), no Redis required
- `ingest:osm:once` — one-off run of `ingest-toll-plazas-osm` (OSM), no Redis required
- `worker` — long-running BullMQ worker + both monthly schedule registrations
