/**
 * Clustering of OSM toll-booth nodes into toll-plaza candidates.
 *
 * A real toll plaza has several lanes, each its own OSM node — see
 * `.aipe/journeys/j-20260916-y9/orientation.md`, which confirmed this against
 * live data (e.g. three "Ecovias Raposo Castello" nodes ~50-150m apart).
 * Pure geometry, no I/O — same philosophy as `match.ts`.
 */

import { haversineMeters } from '@qualroteiro/geo';

import type { OsmTollBooth, TollPlazaCluster } from './types.js';

/**
 * Default clustering radius, in metres.
 *
 * 150m comfortably spans the lane-to-lane spread of a single physical plaza
 * (confirmed against real data — see module doc) while staying well short of
 * the distance between two distinct plazas on the same highway. Overridable
 * per call via {@link clusterTollBooths}'s `radiusMeters` parameter.
 */
export const TOLL_CLUSTER_RADIUS_METERS = 150;

/**
 * Group nearby {@link OsmTollBooth} nodes that share an `operator` into toll
 * plaza candidates.
 *
 * Two booths cluster together only if they share the same `operator` *and*
 * are within `radiusMeters` of each other — booths from different operators
 * never merge, even if they sit metres apart (e.g. two concessionaires'
 * booths flanking a state-line handover). Grouping is transitive within an
 * operator (single-linkage): if A is within range of B, and B of C, all
 * three land in one cluster even if A and C themselves are farther apart than
 * `radiusMeters` — this matches how a real plaza's lanes fan out across
 * several tens of metres, no two of which need be the absolute extremes.
 *
 * Each cluster's representative point is the **booth with the smallest id**,
 * not a computed centroid — its id also names the cluster
 * (`osm-<smallest id>`, matching the natural key {@link TollPlazaCluster}
 * documents), so reusing its own coordinates keeps identity and location
 * traceable to the same real OSM node instead of a synthetic averaged point
 * that corresponds to nothing on the ground.
 *
 * Pure function: no I/O, does not mutate `booths`.
 *
 * @throws {RangeError} if `radiusMeters` is not a positive finite number.
 */
export function clusterTollBooths(
  booths: readonly OsmTollBooth[],
  radiusMeters: number = TOLL_CLUSTER_RADIUS_METERS,
): TollPlazaCluster[] {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new RangeError(
      `clusterTollBooths: radiusMeters must be a positive finite number, received ${radiusMeters}`,
    );
  }

  const indicesByOperator = new Map<string, number[]>();
  booths.forEach((booth, index) => {
    const indices = indicesByOperator.get(booth.operator);
    if (indices) {
      indices.push(index);
    } else {
      indicesByOperator.set(booth.operator, [index]);
    }
  });

  const clusters: TollPlazaCluster[] = [];

  for (const indices of indicesByOperator.values()) {
    const parent = new Map<number, number>(indices.map((i) => [i, i]));

    const find = (start: number): number => {
      let root = start;
      while (parent.get(root) !== root) {
        root = parent.get(root) as number;
      }
      let cursor = start;
      while (cursor !== root) {
        const next = parent.get(cursor) as number;
        parent.set(cursor, root);
        cursor = next;
      }
      return root;
    };

    for (let a = 0; a < indices.length; a += 1) {
      for (let b = a + 1; b < indices.length; b += 1) {
        const boothA = booths[indices[a] as number] as OsmTollBooth;
        const boothB = booths[indices[b] as number] as OsmTollBooth;
        const distance = haversineMeters(
          { lng: boothA.lng, lat: boothA.lat },
          { lng: boothB.lng, lat: boothB.lat },
        );
        if (distance <= radiusMeters) {
          const rootA = find(indices[a] as number);
          const rootB = find(indices[b] as number);
          if (rootA !== rootB) parent.set(rootA, rootB);
        }
      }
    }

    const groupedIndices = new Map<number, number[]>();
    for (const index of indices) {
      const root = find(index);
      const group = groupedIndices.get(root);
      if (group) {
        group.push(index);
      } else {
        groupedIndices.set(root, [index]);
      }
    }

    for (const group of groupedIndices.values()) {
      const groupBooths = group
        .map((index) => booths[index] as OsmTollBooth)
        .sort((x, y) => x.id - y.id);
      const representative = groupBooths[0] as OsmTollBooth;

      clusters.push({
        id: `osm-${representative.id}`,
        operator: representative.operator,
        lat: representative.lat,
        lng: representative.lng,
        boothIds: groupBooths.map((booth) => booth.id),
        chargeTag: representative.chargeTag,
      });
    }
  }

  clusters.sort((a, b) => (a.boothIds[0] as number) - (b.boothIds[0] as number));

  return clusters;
}
