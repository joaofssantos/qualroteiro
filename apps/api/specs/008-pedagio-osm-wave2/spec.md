# spec-kit — Pedágio, OSM como fonte rápida (api, Wave 2)

**Journey**: `j-20260916-y9` ("Pedágio — OSM como fonte rápida, ANTT/ARTESP
como apoio/redundância")
**Unit**: `qualroteiro/api`, Wave 2 — depends on Wave 1 (`qualroteiro/root`,
`packages/tolls`'s `parseOsmCharge`/`clusterTollBooths`) `merged` (PR #36,
commit `dd52cf7`, on `main`).
**Scope**: `apps/api` only. No `apps/web`, no `packages/**`, no
`services/data-ingest` (that is this journey's Wave 3, blocked on this unit
being `merged`).
**SDD route**: same precedent as `apps/api/specs/007-t5-wave2-toll-plazas/`
— this workspace has no installed SDD kit beyond `sdd-lite`
(`.aipe/skills/sdd-lite/SKILL.md`), and a schema migration is explicitly
called out there as something that "wants the full spec-kit flow". This
artifact set follows the same `spec.md` → `plan.md` → task doc shape as
`007-t5-wave2-toll-plazas/` and `006-g1-google-places/`.

---

## Problem

T5 Wave 2 (`j-20260916-9y`, merged) gave `/routes/plan` real toll-plaza
geography from ANTT, but no real tariff — ANTT's own dataset carries none.
`j-20260916-y9`'s Wave 1 (merged) added pure parsing/clustering functions to
`@qualroteiro/tolls` for a second source, OpenStreetMap, whose `charge` tag
carries a real fare 99% of the time. This unit is the persistence half: give
`TollPlazaRecord` somewhere to put an OSM row's `source` and `tariff` without
disturbing a single one of the 277 ANTT rows already in production, and make
`/routes/plan` actually use a tariff when one is present.

**Convivência, não substituição** (orientation.md decision 5): ANTT and OSM
rows for the same physical plaza are NOT deduplicated in this journey — both
persist, independently. This unit's job is only to make room for both, not
to reconcile them.

## Users and their stories

**A traveller planning a route** sees a real price at a toll plaza when the
underlying row came from OSM with a parsed `charge` tag — previously every
real-world plaza (regardless of source) showed no tariff at all.

**`services/data-ingest`'s future OSM ingestion job** (Wave 3, not built
here) needs `source`/`tariff` columns to upsert into, with `source: 'antt'`
guaranteed as every existing row's value so its own upserts (which always
target `source: 'osm'` rows by construction — see orientation.md decision
4, natural key `osm-<id>`) can never collide with or corrupt an ANTT row.

**An operator** checks `GET /admin/toll-plazas-status`'s new `bySource`
breakdown to confirm the OSM job actually ran, without needing database
access — same operational-visibility precedent as `count`/`lastIngestedAt`.

## Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | `TollPlazaRecord` gains `source TollPlazaSource` (Prisma enum `antt \| osm`, `@default(antt)`) and `tariff Json?`. |
| AC-2 | A real migration is generated (`prisma migrate diff`) and applied (`prisma migrate deploy`) against the local Postgres (`localhost:5433`) — additive only (`ADD COLUMN`), never touching existing rows' other columns. |
| AC-3 | The migration backfills every pre-existing row (277 ANTT rows) as `source: 'antt'`, `tariff: null`, via the column default — proven against the live database, not asserted. |
| AC-4 | `toTollPlaza()` (`routes/plan.ts`) converts `record.tariff` back into `@qualroteiro/tolls`'s `TariffByAxleCategory` when it validates as one (every `AxleCategory` key present and numeric); `undefined` otherwise (`null`, malformed JSON, or absent) — never throws on a malformed row. |
| AC-5 | A `source: 'osm'` row with a filled-in `tariff` appears in `POST /routes/plan`'s matched plazas with a real `tariffByAxleCategory`, and its fare contributes to `tolls.total`. |
| AC-6 | A `source: 'antt'` row (`tariff: null`) keeps behaving exactly as T5 Wave 2 shipped it: matched, listed, `tariffByAxleCategory: undefined`, contributing `0` to `total` — proven by re-running Wave 2's own tests unmodified in behaviour (only the fixture's shape grew two fields) plus new tests asserting this explicitly. |
| AC-7 | ANTT and OSM rows coexist in the same request: ANTT plazas stay tariff-less, the OSM plaza's fare is the only contributor to `total`. |
| AC-8 | `GET /admin/toll-plazas-status` gains `bySource: { antt: number, osm: number }`, always both keys present (`0` for a source with no rows). |
| AC-9 | The existing F1/F2a/G1/T5-Wave-2 surface is unaffected (regression): `pnpm --filter @qualroteiro/api test` — every pre-existing test still passes. |

## Out of scope

- **The OSM ingestion job itself** (`services/data-ingest` querying Overpass,
  clustering, upserting `source: 'osm'` rows) — this journey's Wave 3,
  blocked on this unit being `merged`.
- **Deduplicating ANTT and OSM rows covering the same physical plaza** —
  orientation.md decision 5, explicit: redundancy is intentional this phase.
- **Weekend (`Sa-Su`) tariffs** — `parseOsmCharge` (Wave 1) already only
  produces the weekday (`Mo-Fr`) tariff; this unit persists whatever it's
  given and does not add a second tariff column.
- **ARTESP / ANTT Power BI** as additional sources — future journeys, per
  orientation.md.
- **Any `apps/web` change** — `TollPlaza.tariffByAxleCategory` was already
  optional and already rendered both ways by Fase 1's UI work; a plaza with
  a real tariff now shows a value where it previously showed "não
  disponível", with no web code change needed.

## Deliberate limitations

- **`toTollPlaza()`'s tariff validation is structural, not semantic.** It
  confirms every `AxleCategory` key is present and a finite number — it does
  not sanity-check that, say, a truck's fare is higher than a car's. A
  `tariff` JSON blob with implausible-but-numeric values round-trips as a
  real tariff. Malformed *shape* (missing/non-numeric keys) is what this
  unit guards against, mirroring `parseOsmCharge`'s own "skip malformed
  input, never throw" contract from Wave 1.
- **`bySource`'s two keys (`antt`, `osm`) are hardcoded**, not derived from
  the Prisma enum at runtime. Adding a third source (ARTESP, a future
  journey) needs this unit's own follow-up, not just a schema change — a
  conscious, small, documented coupling rather than reflecting over the
  enum for two fixed values.
