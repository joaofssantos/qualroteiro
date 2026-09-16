import { describe, expect, it } from 'vitest';

import { clusterTollBooths } from '../src/index.js';
import type { OsmTollBooth } from '../src/index.js';

// Three lanes of a real physical plaza, ~50-150m apart — modeled on the
// "Ecovias Raposo Castello" cluster found via live Overpass query (see
// orientation.md).
const ecoviasLaneA: OsmTollBooth = {
  id: 302,
  lat: -23.6321,
  lng: -47.0121,
  operator: 'Ecovias Raposo Castello',
  chargeTag: '14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle',
};
const ecoviasLaneB: OsmTollBooth = {
  id: 105,
  lat: -23.6322,
  lng: -47.0119,
  operator: 'Ecovias Raposo Castello',
};
const ecoviasLaneC: OsmTollBooth = {
  id: 511,
  lat: -23.6323,
  lng: -47.0118,
  operator: 'Ecovias Raposo Castello',
};

describe('clusterTollBooths', () => {
  it('groups nearby booths of the same operator into one cluster', () => {
    const clusters = clusterTollBooths([ecoviasLaneA, ecoviasLaneB, ecoviasLaneC]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.boothIds).toEqual([105, 302, 511]);
  });

  it('keys the cluster by, and locates it at, the smallest booth id', () => {
    const clusters = clusterTollBooths([ecoviasLaneA, ecoviasLaneB, ecoviasLaneC]);

    expect(clusters[0]?.id).toBe('osm-105');
    expect(clusters[0]?.lat).toBe(ecoviasLaneB.lat);
    expect(clusters[0]?.lng).toBe(ecoviasLaneB.lng);
  });

  it('carries the representative booth chargeTag through, when present', () => {
    // The smallest-id booth (105) has no chargeTag; a different lane does.
    const clusters = clusterTollBooths([ecoviasLaneA, ecoviasLaneB, ecoviasLaneC]);

    expect(clusters[0]?.chargeTag).toBeUndefined();
  });

  it('never groups booths of different operators, even a few metres apart', () => {
    const operatorX: OsmTollBooth = {
      id: 1,
      lat: -23.6321,
      lng: -47.0121,
      operator: 'Concessionaire X',
    };
    const operatorY: OsmTollBooth = {
      id: 2,
      // ~5m away from operatorX — well within any plausible radius.
      lat: -23.63214,
      lng: -47.01214,
      operator: 'Concessionaire Y',
    };

    const clusters = clusterTollBooths([operatorX, operatorY]);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.operator).sort()).toEqual(['Concessionaire X', 'Concessionaire Y']);
  });

  it('does not group booths of the same operator that are far apart', () => {
    const spPlaza: OsmTollBooth = {
      id: 10,
      lat: -23.6321,
      lng: -47.0121,
      operator: 'Same Operator',
    };
    const rjPlaza: OsmTollBooth = {
      id: 20,
      // Rio de Janeiro — hundreds of km away, same operator name.
      lat: -22.9068,
      lng: -43.1729,
      operator: 'Same Operator',
    };

    const clusters = clusterTollBooths([spPlaza, rjPlaza]);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.boothIds)).toEqual([[10], [20]]);
  });

  it('respects a custom radiusMeters', () => {
    const a: OsmTollBooth = { id: 1, lat: -23.6321, lng: -47.0121, operator: 'Op' };
    // ~130m north.
    const b: OsmTollBooth = { id: 2, lat: -23.63327, lng: -47.0121, operator: 'Op' };

    expect(clusterTollBooths([a, b], 150)).toHaveLength(1);
    expect(clusterTollBooths([a, b], 50)).toHaveLength(2);
  });

  it('returns an empty array for no booths', () => {
    expect(clusterTollBooths([])).toEqual([]);
  });

  it('throws for a non-positive radiusMeters', () => {
    const a: OsmTollBooth = { id: 1, lat: 0, lng: 0, operator: 'Op' };
    expect(() => clusterTollBooths([a], 0)).toThrow(RangeError);
    expect(() => clusterTollBooths([a], -10)).toThrow(RangeError);
  });
});
