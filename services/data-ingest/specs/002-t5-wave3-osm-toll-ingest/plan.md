# Plan

1. Confirm real Overpass volume/shape BEFORE writing the job, per
   orientation.md's explicit instruction. Live queries against
   `overpass-api.de` (2026-09-17): `out count;` → 957 nodes;
   `out;` (not `out tags;`, which omits lat/lon) → the full node set,
   inspected for tag coverage (`operator`/`charge`/`name`/`ref`/`addr:state`).
   This directly shaped the tag-to-column mapping and sentinel design in
   `spec.md`.
2. `src/overpass.ts`: `buildOverpassQuery()` builds the Brazil-area query
   string; `downloadOsmTollBoothNodes()` POSTs it with a real `User-Agent`,
   `AbortController` timeout, and a distinct thrown error when the response
   isn't valid JSON (Overpass's real "server busy" failure mode returns an
   HTML page, observed live during this unit's own research).
3. `src/br-states.ts`: 27-entry exact name→UF lookup, diacritic/case
   normalized (same normalization idea as `slug.ts`).
4. `src/osm-toll-plazas.ts`: `ingestOsmTollPlazas()` — download (or accept
   injected nodes), filter to nodes with a non-blank `operator`
   (`skippedNoOperator` counted), map to `@qualroteiro/tolls`'s
   `OsmTollBooth` shape, `clusterTollBooths()`, then per cluster:
   `parseOsmCharge(cluster.chargeTag)` (tariff omitted if `undefined`/`null`),
   look up the representative (smallest-id) booth's raw tags for
   `name`/`highway`/`uf`/`municipality`, and `upsert` keyed at `cluster.id`.
   Per-cluster upsert failures are caught and counted, not fatal to the run.
5. `src/cli-osm.ts`: on-demand entrypoint mirroring `cli.ts` exactly (own
   file, own script, neither existing entrypoint changes shape).
6. `src/queue.ts`: add `OSM_JOB_NAME`/`OSM_REPEATABLE_JOB_ID`/
   `OSM_MONTHLY_CRON_PATTERN` (offset one day from the ANTT schedule),
   `scheduleMonthlyOsmIngest()`, and dispatch by `job.name` inside the
   existing `createIngestWorker()`.
7. `src/worker.ts`: register both schedules on startup.
8. `src/logger.ts`: `createLogger(job)` factory (the pre-existing `log`
   constant becomes `createLogger('ingest-toll-plazas')`, unchanged log
   lines for the ANTT job); `osm-toll-plazas.ts`/`cli-osm.ts` use their own
   `createLogger('ingest-toll-plazas-osm')`.
9. `src/index.ts` + `package.json`: export the new surface, add the
   `@qualroteiro/tolls` dependency and `ingest:osm:once` script.
10. Build `@qualroteiro/geo` then `@qualroteiro/tolls` first (unbuilt
    workspace dependencies' `dist` — same reasoning Wave 1's plan.md
    documents for running a package's scripts directly instead of through
    turbo's `^build` graph), then `pnpm --filter @qualroteiro/data-ingest
    typecheck/lint/test`.
11. Capture real Overpass fixture nodes for `tests/fixtures/sample-osm-toll-booths.json`
    (not synthetic data): a real 4-lane cluster, a real 2-lane cluster from
    the same operator that must not merge with it, a real same-operator node
    ~14km away, one real example of each of Wave 1's four `charge` patterns,
    a real operator-less node, a real node with a `name` tag but no
    `charge`, and the real `addr:state="Minas Gerais"` pair.
12. `tests/overpass.test.ts`, `tests/br-states.test.ts`,
    `tests/osm-toll-plazas.test.ts`: query shape, User-Agent/method, the real
    "busy" HTML response handling, all 27 UF names, clustering/merging
    behavior against the real fixture, tariff parsing per pattern, sentinel
    fallbacks, idempotency, per-record error isolation.
13. Real Postgres run (`localhost:5433`, `.env` gitignored, DB URL pointed at
    the shared local instance): confirm `antt` baseline (277) BEFORE running;
    run `pnpm ingest:osm:once` once for real against the live Overpass API;
    confirm via direct SQL AND `GET /admin/toll-plazas-status` (booted
    `apps/api` locally with placeholder third-party keys — never real
    secrets — purely to exercise this one unauthenticated, DB-only route);
    run a second time; confirm zero row-count change on either source and
    `ingestedAt` bumped only on the `osm` rows.
14. `pnpm -w build` once, full workspace, to confirm zero downstream breakage.

## Evidence (real production run, 2026-09-17)

```
Baseline:            antt=277  osm=0    (SQL: select source, count(*) ... group by source)
Run 1 (cli-osm):     totalNodesRead=957 skippedNoOperator=21 clusters=489
                      upserts=489 tariffParsed=487 tariffMissing=2 errors=0
After run 1 (SQL):    antt=277  osm=489  (total 766)
Run 2 (cli-osm):     totalNodesRead=957 skippedNoOperator=21 clusters=489
                      upserts=489 tariffParsed=487 tariffMissing=2 errors=0
After run 2 (SQL):    antt=277  osm=489  (total 766 — unchanged, no duplicates)
                      ingestedAt on osm rows: single timestamp == run 2's start
                      (proves real UPDATE, not a no-op or a duplicate INSERT)
GET /admin/toll-plazas-status (real HTTP, apps/api booted locally):
  { "count": 766, "lastIngestedAt": "...", "bySource": { "antt": 277, "osm": 489 } }
```

Two of this unit's own preliminary research queries against the live
Overpass endpoint returned the real "server busy" HTML error (not JSON) —
reproduced the exact failure mode `overpass.ts` is built to surface
distinctly. A single manual retry (not an in-process loop) succeeded both
times, including for the final production run above.

## Notes for the coordinator

- `pnpm-lock.yaml` has a 3-line diff (the new `@qualroteiro/tolls` workspace
  edge for `services/data-ingest`) — the only file outside
  `services/data-ingest/**` this unit touches, and unavoidable for adding a
  real dependency. See `spec.md`'s "Deliberate limitations".
- The real 489 OSM plazas are almost entirely disjoint from the 277 ANTT
  plazas by natural key (`osm-<id>` vs. the ANTT slug format), so `source`
  cleanly partitions them — no key collision was observed or is possible by
  construction.
