import type { LineString } from '@qualroteiro/geo';
import { isWithinBuffer } from '@qualroteiro/geo';
import { describe, expect, it } from 'vitest';

import {
  TOLL_MATCH_BUFFER_METERS,
  corridorPolyline,
  getCorridor,
  listCorridors,
  matchFuelStations,
} from '../src/index.js';

const dutra = getCorridor('sp-rj-dutra');
const dutraPolyline = corridorPolyline('sp-rj-dutra');

/** Somewhere in the Atlantic, well away from any seeded corridor. */
const emptyOcean: LineString = {
  type: 'LineString',
  coordinates: [
    [-30, -20],
    [-29, -19],
    [-28, -18],
  ],
};

describe('seed dataset — fuel stations', () => {
  describe.each(listCorridors())('corridor $id', (corridor) => {
    it('seeds between 4 and 6 fuel stations', () => {
      expect(corridor.fuelStations?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(corridor.fuelStations?.length ?? 0).toBeLessThanOrEqual(6);
    });

    it('gives every fuel station a name and plausible Brazilian coordinates', () => {
      for (const station of corridor.fuelStations ?? []) {
        expect(station.name.length).toBeGreaterThan(0);
        expect(station.lat).toBeGreaterThan(-34);
        expect(station.lat).toBeLessThan(6);
        expect(station.lng).toBeGreaterThan(-74);
        expect(station.lng).toBeLessThan(-34);
      }
    });

    it('uses unique fuel station ids', () => {
      const ids = (corridor.fuelStations ?? []).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('is self-consistent: every fuel station lies within the buffer of its own reference polyline', () => {
      const polyline = corridorPolyline(corridor.id);
      for (const station of corridor.fuelStations ?? []) {
        expect(
          isWithinBuffer({ lng: station.lng, lat: station.lat }, polyline, TOLL_MATCH_BUFFER_METERS),
          `${station.id} is off its own corridor polyline`,
        ).toBe(true);
      }
    });
  });

  it('keeps fuel station ids unique across the whole seed', () => {
    const ids = listCorridors().flatMap((c) => (c.fuelStations ?? []).map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('matchFuelStations — SP–RJ (Presidente Dutra) corridor', () => {
  it('returns exactly the Dutra fuel stations for the Dutra reference polyline', () => {
    const { stations } = matchFuelStations({ routeGeometry: dutraPolyline });

    expect(stations.map((s) => s.id).sort()).toEqual(
      (dutra.fuelStations ?? []).map((s) => s.id).sort(),
    );
    expect(stations.length).toBeGreaterThan(0);
  });

  it('gives every matched station a location within the buffer of the route', () => {
    const { stations } = matchFuelStations({ routeGeometry: dutraPolyline });

    for (const station of stations) {
      expect(
        isWithinBuffer({ lng: station.lng, lat: station.lat }, dutraPolyline, TOLL_MATCH_BUFFER_METERS),
      ).toBe(true);
    }
  });

  it('does not pick up stations from the other two corridors', () => {
    const { stations } = matchFuelStations({ routeGeometry: dutraPolyline });
    const foreign = stations.filter(
      (s) => !(dutra.fuelStations ?? []).some((seeded) => seeded.id === s.id),
    );

    expect(foreign).toEqual([]);
  });
});

describe('matchFuelStations — a route that passes nothing', () => {
  it('returns an empty stations list', () => {
    expect(matchFuelStations({ routeGeometry: emptyOcean })).toEqual({ stations: [] });
  });
});

describe('matchFuelStations — corridorHint', () => {
  it('narrows the candidate set to the hinted corridor', () => {
    const hinted = matchFuelStations({
      routeGeometry: dutraPolyline,
      corridorHint: 'sp-campinas-bandeirantes',
    });

    // The Dutra route passes no Bandeirantes station, so hinting the wrong
    // corridor yields nothing — proving the hint really did restrict the search.
    expect(hinted.stations).toEqual([]);
  });

  it('gives the same answer as an unhinted search when the hint is correct', () => {
    const hinted = matchFuelStations({ routeGeometry: dutraPolyline, corridorHint: 'sp-rj-dutra' });
    const unhinted = matchFuelStations({ routeGeometry: dutraPolyline });

    expect(hinted).toEqual(unhinted);
  });

  it('throws for an unknown corridor hint', () => {
    expect(() =>
      // @ts-expect-error — exercising the runtime guard with an invalid id
      matchFuelStations({ routeGeometry: dutraPolyline, corridorHint: 'nope' }),
    ).toThrow(/unknown corridor/i);
  });
});

describe('matchFuelStations — degenerate input', () => {
  it('rejects an empty route geometry', () => {
    expect(() =>
      matchFuelStations({ routeGeometry: { type: 'LineString', coordinates: [] } }),
    ).toThrow(RangeError);
  });

  it('rejects a non-positive buffer', () => {
    expect(() =>
      matchFuelStations({ routeGeometry: dutraPolyline, bufferMeters: 0 }),
    ).toThrow(RangeError);
  });

  it('handles the other two corridors too', () => {
    for (const id of ['sp-curitiba-regis-bittencourt', 'sp-campinas-bandeirantes'] as const) {
      const { stations } = matchFuelStations({ routeGeometry: corridorPolyline(id) });
      expect(stations.map((s) => s.id).sort()).toEqual(
        (getCorridor(id).fuelStations ?? []).map((s) => s.id).sort(),
      );
      expect(stations.length).toBeGreaterThan(0);
    }
  });
});
