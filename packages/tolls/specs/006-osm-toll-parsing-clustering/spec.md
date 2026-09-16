# T6 — Toll via OSM, Wave 1 (parsing + clustering)

> SDD written by hand: `aipe skill match --task-type feature --size medium`
> returned `sdd=none` (no SDD kit installed in this worktree). This file
> follows the format of `specs/005-real-toll-plazas-foundation` to keep the
> package's SDD trail consistent. Full architectural reasoning — including the
> live Overpass research behind the four `charge` patterns — lives in
> `.aipe/journeys/j-20260916-y9/orientation.md` (outside this package); this
> spec is the package-scoped summary of Wave 1 only.

## Problem

Wave 1 of `j-20260916-9y` (ANTT) gave the app real toll-plaza geometry but no
real tariffs. This journey (`j-20260916-y9`) adds OpenStreetMap as a second,
independent source — geo *and* tariff in one query, covering both federal and
state highways. A live Overpass query (SP + surrounding area) found 508
`barrier=toll_booth` nodes, 503 of them (99%) already carrying a `charge` tag
in one of exactly four structural patterns.

Two problems stand between that raw OSM data and a usable
`TariffByAxleCategory`/`TollPlaza`:

1. **The `charge` tag is a compact, semicolon-delimited micro-format**, not
   JSON — it needs a dedicated parser, tolerant of the three vehicle classes
   OSM actually distinguishes (`motorcar`/`motorcycle`/`hgv`) mapping onto the
   app's eight {@link AxleCategory}s, and tolerant of unrecognized shapes
   (external data from thousands of independent mappers) without ever
   throwing.
2. **One OSM node is one lane, not one plaza.** A real toll plaza has several
   physical lanes, each tagged as its own node a few tens of metres apart.
   Downstream code needs one record per physical plaza, so nearby same-operator
   nodes must be clustered before they become `TollPlazaCluster` candidates.

This is Wave 1 of three: `packages/tolls` only, pure functions, no I/O. Wave 2
(`apps/api`, a separate repo unit) adds the `source`/`tariff` Prisma columns
these functions' outputs will eventually feed. Wave 3 (`services/data-ingest`,
gated on Wave 2 `merged`) is the actual Overpass ingestion job that calls
`parseOsmCharge` and `clusterTollBooths` on live data and upserts the result.

## Scope

**In:**
- `packages/tolls/src/types.ts` — two new types: `OsmTollBooth` (one OSM
  `barrier=toll_booth` node: `id`, `lat`, `lng`, `operator`, optional
  `chargeTag`) and `TollPlazaCluster` (a cluster's `id`, `operator`, `lat`,
  `lng`, `boothIds`, optional `chargeTag`).
- `packages/tolls/src/osm-charge.ts` — new file, `parseOsmCharge(chargeTag:
  string): TariffByAxleCategory | null`.
- `packages/tolls/src/osm-cluster.ts` — new file, `clusterTollBooths(booths:
  readonly OsmTollBooth[], radiusMeters?: number): TollPlazaCluster[]` and the
  `TOLL_CLUSTER_RADIUS_METERS` default-radius constant (150m).
- `packages/tolls/src/index.ts` — exports the two new types and two new
  functions/constant.
- `packages/tolls/tests/osm-charge.test.ts`, `tests/osm-cluster.test.ts` — new
  test files, one per new source file (matching the package's existing
  one-test-file-per-source-file convention).

**Out (deliberate, per orientation.md):**
- Weekend (`Sa-Su`) differential pricing — `parseOsmCharge` uses only the
  `Mo-Fr` (or untagged) entries; `Sa-Su` entries are parsed then discarded.
  Documented limit, not a bug.
- Actually calling the Overpass API, or any HTTP/network code — Wave 3
  (`services/data-ingest`), gated on Wave 2 (`apps/api`'s `source`/`tariff`
  columns) being merged.
- The Prisma `source`/`tariff` columns and `toTollPlaza()` conversion —
  Wave 2, a different repo unit (`qualroteiro/api`).
- Visual deduplication between an ANTT plaza and an OSM plaza covering the
  same physical location — explicitly out of scope for the whole journey
  (redundancy is intentional; see orientation.md).

## Design decisions

### `parseOsmCharge`: the four patterns, and why they collapse to one grammar

Live data showed exactly four structural shapes, all sharing one entry
grammar — `[dayRange ]amountBRL/vehicleClass[/axle]`, semicolon-separated:

1. `"14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle"` — the real value
   cited in orientation.md, one of the 503 tagged SP-area booths.
2. `"...;14.50BRL/hgv"` — same, `hgv` without the `/axle` suffix.
3. `"...;14.50BRL/hgva/axle"` — the `hgva` spelling variant.
4. `"Mo-Fr 14.50BRL/motorcar;...;Sa-Su 18.00BRL/motorcar;..."` — weekday vs.
   weekend fares; only `Mo-Fr` entries are kept.

Patterns 2 and 3 differ from pattern 1 only in whether the heavy-vehicle entry
carries `hgv` or `hgva`, and whether it carries `/axle` — none of that changes
the *semantics*: OSM's heavy-vehicle charge is always a per-axle BRL rate. One
regex (`^(?:(Mo-Fr|Sa-Su)\s+)?(\d+(?:\.\d+)?)BRL\/(motorcar|motorcycle|hgva|hgv)(?:\/axle)?$`)
parses every entry of all four patterns; day-range filtering (drop `Sa-Su`)
then collapses pattern 4 onto the same shape as 1-3.

Any segment that doesn't match the grammar, or a currency other than `BRL`, or
missing one of the three required vehicle classes after filtering →
**`null`**, never a thrown exception. `charge` is 503 independent mappers'
free-text; a parser for it has to expect the unexpected.

### Category mapping and the axle-count formula

OSM distinguishes three vehicle classes against the app's eight
`AxleCategory`s:

- `motorcycle` → `motorcycle`, unchanged.
- `motorcar` → **both** `car` and `car_with_trailer`, same value for both —
  OSM has no tag distinguishing a car towing a trailer from one that isn't.
- `hgv`/`hgva` (a per-axle BRL rate) → `truck_2_axle` … `truck_6_axle`, each
  computed as:

  ```
  truck_N_axle = round_cents(hgvPerAxleBrl * N)   for N in {2, 3, 4, 5, 6}
  ```

  This is the **exact formula chosen**: multiply OSM's own per-axle rate by
  the axle count the category name encodes. It mirrors the *shape* of
  `AXLE_MULTIPLIERS` in `tariff.ts` — more axles pay proportionally more — but
  is **not** the same ladder numerically. `AXLE_MULTIPLIERS` prices from a
  *car* base fare and encodes rodagem-simples-vs-dupla (why `truck_2_axle`'s
  multiplier is `2`, not `1`, despite a 2-axle truck and a car both having two
  axles — the truck pays double for twinned rear wheels). OSM's `hgv/axle`
  charge has no equivalent car-relative anchor to reuse; it is already a
  literal "amount owed per axle of *this* heavy vehicle" rate, which is
  exactly what multiplying by axle count reproduces. Reusing
  `AXLE_MULTIPLIERS`' *numbers* here would have silently mixed two unrelated
  proportionality bases; reusing its *shape* (linear-in-axle-count) while
  starting from OSM's own number is the coherent choice, and is what
  `orientation.md`'s mapping section asks for ("a partir do valor por-eixo do
  OSM em vez de expandir de uma tarifa-base de carro").

All monetary values are rounded to the cent (`Math.round(value * 100) / 100`)
the same way `tariffTable()` in `tariff.ts` does, kept as a small local helper
rather than importing from `tariff.ts` to avoid coupling two independently
evolving tariff-derivation paths (demo-seed base-fare expansion vs.
OSM-per-axle expansion) through a shared internal.

### `clusterTollBooths`: types and algorithm

**Input** — `OsmTollBooth = { id: number; lat: number; lng: number; operator:
string; chargeTag?: string }`. `chargeTag` is optional and carried through so
a caller can run `clusterTollBooths` first and `parseOsmCharge` on the
resulting representative's tag second, without re-joining back to the raw OSM
response.

**Output** — `TollPlazaCluster = { id: string; operator: string; lat: number;
lng: number; boothIds: readonly number[]; chargeTag?: string }`.

- **`id`**: `` `osm-${smallest booth id in the cluster}` ``, matching the
  natural key orientation.md's coordinator decision already settled on
  (decision #4) — built here rather than left to Wave 3, since it is a pure
  derivation from the cluster's own membership and Wave 3 needs exactly this
  string as its upsert key.
- **`lat`/`lng`**: the smallest-id booth's *own* coordinates, not a computed
  centroid. Chosen over a centroid because (a) it keeps the cluster's location
  traceable to one real, dereferenceable OSM node — the same one that names
  it — rather than a synthetic point that corresponds to nothing on the
  ground, and (b) it avoids centroid edge cases (antimeridian wraparound,
  latitude-weighted averaging) for a benefit (a few metres of extra geometric
  centering within a ≤150m cluster) too small to matter at the ~500m toll
  route-matching buffer this feeds into.
- **`boothIds`**: every member's id, ascending.

**Algorithm**: booths are first partitioned by `operator` — different
operators never merge, full stop, regardless of distance. Within one
operator's partition, union-find (disjoint-set) links any two booths within
`radiusMeters` (default `TOLL_CLUSTER_RADIUS_METERS = 150`) of each other,
using `haversineMeters` from `@qualroteiro/geo` (already used package-wide for
great-circle distance). This is **single-linkage** clustering: A and C land in
the same cluster if A-B and B-C are each within range, even if A-C itself
exceeds `radiusMeters` — matching how a real plaza's lanes fan out across
several tens of metres, no two of which need be the absolute extremes from
each other. 150m was chosen from the live data cited in orientation.md (three
real "Ecovias Raposo Castello" nodes 50-150m apart, confirmed the same
physical plaza).

Pure function, no I/O, does not mutate its input — same philosophy as
`match.ts`. `radiusMeters` non-positive or non-finite throws `RangeError`
(same validation style as `matchTolls`/`matchFuelStations`).

## Acceptance

- `pnpm --filter @qualroteiro/tolls typecheck`, `lint`, `test` all green.
  (`lint` has no script in this package, same as `@qualroteiro/geo` — turbo
  reports 0 tasks / 0 failures, which is the established "green" for this
  package; see `specs/005-real-toll-plazas-foundation/spec.md`.)
- Test: all four real `charge` patterns from orientation.md parse correctly —
  pattern 1 is the literal cited real value
  (`"14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle"`); patterns 2-4
  are structurally-accurate reconstructions using the same real cited amounts
  (14.50 / 0.00), since orientation.md transcribed only pattern 1 verbatim.
- Test: malformed/empty/unknown-format `charge` → `null`, confirmed to never
  throw (`expect(() => ...).not.toThrow()` alongside the `null` assertion).
- Test: the `Mo-Fr`/`Sa-Su` pattern uses only the `Mo-Fr` value.
- Test: clustering groups nearby same-operator booths into one cluster, keyed
  and located at the smallest-id booth.
- Test: clustering never groups different-operator booths, even ~5m apart.
- Test: clustering never groups same-operator booths outside the radius (SP
  vs. Rio de Janeiro, and a radius-boundary case at 150m vs. 50m).
- `pnpm -w build` green (confirmed: 8/8 packages, including `apps/api` and
  `apps/web`, which don't consume the new exports and are unaffected).
- `git diff --name-only origin/main..HEAD` touches only `packages/tolls/**`
  (6 files: `src/index.ts`, `src/types.ts` modified; `src/osm-charge.ts`,
  `src/osm-cluster.ts`, `tests/osm-charge.test.ts`, `tests/osm-cluster.test.ts`
  new).
