# spec-kit — j-20260916-y9 Wave 3 (root/services/data-ingest): Ingestão OSM de praças de pedágio

**Journey**: `j-20260916-y9` ("Pedágio — OSM como fonte rápida, ANTT/ARTESP
como apoio/redundância")
**Unit**: `qualroteiro/root`, Wave 3 (second round of this same unit within
this journey) — depends on Wave 1 (`packages/tolls`: `parseOsmCharge` +
`clusterTollBooths`, this unit, already `merged`) AND Wave 2
(`qualroteiro/api`: `TollPlazaRecord.source`/`tariff`, `toTollPlaza()`,
`GET /admin/toll-plazas-status`'s `bySource`, already `merged`).
**Scope**: `services/data-ingest` only, plus the unavoidable `pnpm-lock.yaml`
entry for the new `@qualroteiro/tolls` workspace dependency edge (see
"Deliberate limitations").
**SDD route**: `aipe skill match` returned `sdd=none — no SDD kit is
installed`, same as every other wave of this journey. This artifact set
follows the format `packages/tolls/specs/006-osm-toll-parsing-clustering`
(Wave 1) already established for this journey.

---

## Problem

Wave 1 gave the app `parseOsmCharge`/`clusterTollBooths` as pure functions;
Wave 2 gave `TollPlazaRecord` a `source`/`tariff` column pair. Nothing yet
calls the Overpass API for real or writes an `osm`-sourced row. This unit is
that job: query Overpass for every Brazilian `barrier=toll_booth` node,
cluster + parse them via Wave 1's functions, and upsert them idempotently as
`source: 'osm'` rows that coexist with (never overwrite) the 277 pre-existing
`antt` rows.

## Real findings from live research (this unit, 2026-09-17)

- **Real Brazil-wide volume: 957 nodes** (`out count;` against
  `area["ISO3166-1"="BR"][admin_level=2]`, confirmed twice, once via count-only
  and once against the full `out;` payload). orientation.md's own estimate
  ("poucos milhares", extrapolated from a ~500-node SP-area sample) turned out
  high — the real number is under a thousand. No timeout, no pagination
  needed: one `[out:json][timeout:180]` request comfortably completes (the
  real production run took ~5-10s end to end, download included).
- **`out tags;` omits `lat`/`lon` for nodes** — an early research query using
  it returned zero coordinates. The real query (`overpass.ts`) uses `out;`.
- **Tag coverage on the real 957 nodes**: `operator` on 936 (98%), `charge` on
  943 (99%), `name` on only 16 (2%), `ref` (highway) on 26 (3%),
  `addr:state`/`addr:city` on 2 (0.2%, and `addr:state` carries the state's
  full Portuguese name, e.g. `"Minas Gerais"`, never a UF code). This directly
  shaped the tag-to-column mapping in "Design decisions" below.
- The real production run (see "Evidence" below): **957 nodes → 21 skipped
  (no `operator`) → 489 clusters → 489 upserts, 0 errors, 487 tariffs parsed,
  2 missing** (one node with `charge` absent entirely, one with a `charge`
  value not matching any of Wave 1's four known patterns).
- Overpass genuinely returned its HTML "server busy" error page (not JSON)
  twice during this unit's own research queries against the live endpoint —
  a real, reproducible failure mode, not a hypothetical. `downloadOsmTollBoothNodes`
  surfaces it as a distinct, readable thrown error (see `overpass.ts`) rather
  than retrying in a loop or masking it.

## Scope

**In:**
- `src/overpass.ts` — Overpass client: `buildOverpassQuery()` (Brazil OSM
  area, not a bounding box), `downloadOsmTollBoothNodes()` (POST,
  `User-Agent`, `[timeout:180]`, client-side `AbortController`, one request,
  no retry loop, distinct error on a non-JSON "busy" response).
- `src/br-states.ts` — `ufFromStateName()`, a small exact lookup (27 real
  state/DF names → UF code) for the rare `addr:state` tag.
- `src/osm-toll-plazas.ts` — `ingestOsmTollPlazas()`: download → filter to
  nodes with an `operator` → `clusterTollBooths` → `parseOsmCharge` per
  cluster → upsert `source: 'osm'`, keyed at the cluster's own
  `osm-<smallest node id>` id.
- `src/cli-osm.ts` — on-demand entrypoint (`pnpm ingest:osm:once`), same
  shape as the existing `cli.ts`.
- `src/queue.ts` (modified) — a second job name (`ingest-toll-plazas-osm`)
  and repeatable schedule within the SAME `QUEUE_NAME` queue, dispatched by
  `Job.name` inside the one shared `Worker`.
- `src/worker.ts` (modified) — registers both monthly schedules.
- `src/logger.ts` (modified) — `createLogger(job)` factory, so the OSM job's
  log lines correctly say `job: 'ingest-toll-plazas-osm'` instead of
  misleadingly inheriting the ANTT job's hardcoded `'ingest-toll-plazas'`.
- `src/index.ts` (modified) — exports the above.
- `package.json` (modified) — `@qualroteiro/tolls` dependency,
  `ingest:osm:once` script.
- `tests/overpass.test.ts`, `tests/br-states.test.ts`,
  `tests/osm-toll-plazas.test.ts`, `tests/fixtures/sample-osm-toll-booths.json`
  (real captured Overpass nodes — see "Design decisions").

**Out (deliberate, per orientation.md):**
- Weekend (`Sa-Su`) differential pricing, category mapping formula, and the
  clustering algorithm itself — all Wave 1 (`packages/tolls`), already
  merged, reused here unmodified.
- The `source`/`tariff` Prisma columns and `toTollPlaza()` — Wave 2
  (`qualroteiro/api`), already merged.
- Visual deduplication between an `antt` and an `osm` row covering the same
  physical plaza — explicitly out of scope for the whole journey.
- ARTESP / ANTT Power BI ingestion — future journeys.
- Any change to `apps/api` or `apps/web`.

## Design decisions

### Tag-to-column mapping, and the honest "unknown" sentinels

`TollPlazaRecord.highway`/`uf`/`municipality`/`km` are `NOT NULL` (ANTT always
supplies them), but the real tag coverage table above shows OSM's
toll-booth nodes mostly don't carry the tags that would populate them
accurately. Rather than fabricate precision (e.g. reverse-geocoding a state
from lat/lng, or guessing a highway ref from the operator's usual corridor),
a node missing the relevant tag gets an explicit sentinel:

| Column | Source | Fallback |
|---|---|---|
| `name` | `tags.name`, else `tags.note` | `"${operator} (OSM ${id})"` |
| `highway` | `tags.ref` | `"Não informado (OSM)"` |
| `uf` | `tags['addr:state']` via `ufFromStateName()` | `"BR"` (never a real UF — reads unambiguously as "not resolved") |
| `municipality` | `tags['addr:city']` | `"Não informado (OSM)"` |
| `km` | *(no OSM equivalent)* | `0` (not read by `matchTolls`'s geometry-based matching — see `osm-toll-plazas.ts`) |

`uf` cannot hold `tags['addr:state']` directly even when present — it's a
`VARCHAR(2)` Postgres column and the tag carries a full name
(`"Minas Gerais"`), which would be a hard DB error, not a truncation.
`ufFromStateName()` is an exact 27-entry lookup, not a geocoding heuristic:
it returns a code only for a name it recognizes verbatim.

### `tariff`: optional property, not `tariff: null`

Prisma's generated `create`/`update` input types for a nullable `Json?`
column accept a value or `undefined`, but not a literal `null` (that's
reserved for the distinct `Prisma.JsonNull` sentinel). `OsmTollPlazaRecordInput.tariff`
is therefore `TariffByAxleCategory | undefined` (an optional property, simply
omitted when `parseOsmCharge` returns `null` or the representative booth
carries no `charge` tag at all) — confirmed necessary by a real `tsc` failure
against the real generated Prisma Client during this unit's own work (see
`osm-toll-plazas.ts`'s doc-comment for the full reasoning and its one
consequence: `update`'s `undefined` leaves a previously-parsed tariff
untouched rather than clearing it, if a `charge` tag disappears between two
monthly runs — same "stale, not cleared" limitation shape the ANTT job
already documents for `active`).

### One queue, two job names

The OSM job reuses `QUEUE_NAME` (`ingest-toll-plazas`) rather than a second
`Queue`/Redis connection pair — same infrastructure, dispatched by
`Job.name` inside the one `Worker` (BullMQ's own documented pattern). The two
monthly schedules are offset by a day (`MONTHLY_CRON_PATTERN`: 1st,
`OSM_MONTHLY_CRON_PATTERN`: 2nd) so they don't land on the same worker tick.

### Representative-lane tariff, unchanged from Wave 1

`TollPlazaCluster.chargeTag` carries only the smallest-id booth's tag. If
that lane lacks `charge` while a sibling lane in the same cluster has one,
this job's tariff is `undefined` (counted in `tariffMissing`), not borrowed
from the sibling — matching Wave 1's own documented behavior rather than
adding new cross-lane reconciliation.

## Acceptance

- `pnpm --filter @qualroteiro/data-ingest typecheck/lint/test` all green —
  **41 tests pass** (7 test files: the 4 pre-existing plus
  `overpass.test.ts`, `br-states.test.ts`, `osm-toll-plazas.test.ts`).
- Test: real Overpass nodes (`tests/fixtures/sample-osm-toll-booths.json`,
  captured live 2026-09-17) covering all 4 `charge` patterns, a real 4-lane
  cluster ("Osasco", `Ecovias Raposo Castello`) plus a real 2-lane cluster
  ("Barueri", same operator) that must NOT merge with it (>150m apart, real
  coordinates), a real same-operator-but-14km-away node ("Itapevi") that must
  also not merge, a node missing `operator` (skipped, counted), a node
  missing `charge` (upserts with `tariff` omitted, name from its real `name`
  tag), and the real `addr:state="Minas Gerais"` pair — confirm clustering +
  parsing + upsert with `source: 'osm'` throughout, plus idempotency (same
  fixture run twice → same row count, `updateCalls` only on the second run).
- **Real Postgres run** (localhost:5433, shared with other worktrees this
  session — see "Evidence"): job run twice against the live Overpass API;
  `antt` count proven unchanged (277 → 277) both times; `osm` count 0 → 489 →
  489 (no duplicates); confirmed both via direct SQL and via the real
  `GET /admin/toll-plazas-status` HTTP endpoint.
- `git diff --name-only origin/main..HEAD` touches only `services/data-ingest/**`,
  plus `pnpm-lock.yaml` (see "Deliberate limitations" — unavoidable, a
  3-line addition recording the new `@qualroteiro/tolls` workspace
  dependency edge, no external package version changed).
- `pnpm -w build` green (8/8 packages).

## Deliberate limitations

- **`uf`/`municipality`/`highway`/`km` are best-effort sentinels for the
  large majority of OSM rows** (see the tag-coverage table above) — this
  job's accuracy promise is `lat`/`lng`/`tariff`/`concessionaire`, not the
  ANTT-shaped administrative fields, which OSM's `barrier=toll_booth` nodes
  mostly don't carry. Not hidden: `uf: 'BR'` is never a real UF code, so it
  reads unambiguously as "not resolved" rather than a plausible-but-wrong
  guess.
- **A cleared `charge` tag between two monthly runs leaves the previous
  tariff stale, not nulled** — see "`tariff`: optional property" above.
  Same shape as the ANTT job's own documented `active`-staleness limitation.
- **`pnpm-lock.yaml` is touched** despite the "services/data-ingest/** only"
  rule — unavoidable consequence of adding a real new workspace dependency
  edge (`@qualroteiro/tolls`), not a scope leak. Diff is exactly 3 lines
  (the new `specifier`/`version` entry under `services/data-ingest`'s
  importer).
- **No retry loop around the Overpass request** — a failed/timed-out/busy
  response throws once, surfaced to the caller's structured error log (CLI
  exit code 1, or a failed BullMQ job — BullMQ's own configurable retry
  applies at that layer, same precedent as the ANTT job's download). This
  unit's own research hit the real "busy" HTML response twice live — retrying
  once, by hand, resolved it both times; no aggressive in-process retry loop
  was added, per orientation.md's explicit fair-use instruction.
