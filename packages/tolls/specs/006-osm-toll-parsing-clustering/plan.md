# Plan

1. `types.ts`: add `OsmTollBooth` and `TollPlazaCluster` interfaces alongside
   the package's other domain types (`TollPlaza`, `FuelStationSeed`,
   `Corridor`), same placement convention `tariff.ts`/`match.ts` already
   follow (import types from `types.ts`, define logic elsewhere).
2. `osm-charge.ts`: one regex (`CHARGE_ENTRY_PATTERN`) parses every semicolon
   segment of a `charge` value into `{ dayRange?, amountBrl, vehicleClass }`;
   `parseOsmCharge` splits on `;`, parses each segment, bails to `null` on any
   unparseable segment or unknown currency, filters out `Sa-Su` entries,
   folds `hgv`/`hgva` into one key, requires all three vehicle classes present
   post-filter, then builds the 8-category table (`motorcycle`/`car`/
   `car_with_trailer` direct, `truck_2_axle`…`truck_6_axle` via
   `hgvPerAxleBrl * axleCount`).
3. `osm-cluster.ts`: partition booths by `operator` into index lists; within
   each partition run union-find over all pairs within `radiusMeters` (uses
   `haversineMeters` from `@qualroteiro/geo`, already a workspace dependency);
   emit one `TollPlazaCluster` per resulting group, keyed/located at the
   smallest-id member; sort the final array by that id for deterministic
   output order.
4. `index.ts`: export the two new types, `parseOsmCharge`,
   `clusterTollBooths`, and `TOLL_CLUSTER_RADIUS_METERS`.
5. `tests/osm-charge.test.ts`: one `it` per pattern (1-4) asserting the full
   8-category table, plus an `it.each` table of malformed/unknown inputs
   asserting both `null` and never-throws, plus a dedicated assertion that
   `car`/`car_with_trailer` share the same motorcar-derived value.
6. `tests/osm-cluster.test.ts`: a 3-booth same-operator cluster modeled on the
   real "Ecovias Raposo Castello" example from orientation.md (grouping,
   `id`/`lat`/`lng` keyed on the smallest id, `chargeTag` passthrough);
   different-operator non-grouping at ~5m; same-operator non-grouping at
   province-scale distance; a radius-boundary case (150m default groups,
   50m custom does not); empty input; `radiusMeters <= 0` throws.
7. Build `@qualroteiro/geo` first (unbuilt workspace dependency's `dist` is
   what makes `tsc` fail otherwise when running a package's scripts directly
   instead of through turbo's `^build` graph), then run `@qualroteiro/tolls`
   `typecheck`/`lint`/`test`.
8. `pnpm -w build` once, full workspace, to confirm zero downstream breakage
   (this unit adds new exports only — nothing in `apps/api`/`apps/web`
   references them yet, so none of the prior unit's "expected breakage"
   pattern applies here).

## Notes for the coordinator / Wave 3 dispatch

- `TollPlazaCluster.id` is already formatted as `osm-<smallest booth id>` —
  Wave 3 (`services/data-ingest`) can use it directly as the upsert natural
  key without reformatting.
- `TollPlazaCluster.chargeTag` carries the *representative* (smallest-id)
  booth's tag only, not every member's. If a future wave needs to reconcile
  disagreeing `charge` tags across a cluster's lanes, that reconciliation
  logic doesn't exist yet — today it's "trust the smallest-id lane," which
  matched the one real 3-lane example inspected in orientation.md (only one
  lane in that cluster carried a `charge` tag at all).
