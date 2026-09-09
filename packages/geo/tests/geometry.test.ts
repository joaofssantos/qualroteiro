import { describe, expect, it } from 'vitest';

import {
  haversineMeters,
  isWithinBuffer,
  kmMarker,
  lineLengthMeters,
  nearestPointOnLine,
  pointAtFraction,
} from '../src/index.js';
import type { LineString } from '../src/index.js';

/**
 * A 0.02°-long segment of the equator, running east from the prime meridian.
 * At the equator 1° of longitude is ~111.32 km, so this line is ~2226 m long
 * and 0.001° of latitude off it is ~110.6 m.
 */
const equatorLine: LineString = {
  type: 'LineString',
  coordinates: [
    [0, 0],
    [0.02, 0],
  ],
};

describe('haversineMeters', () => {
  it('measures one degree of latitude as ~111.2 km', () => {
    const d = haversineMeters({ lng: 0, lat: 0 }, { lng: 0, lat: 1 });
    expect(d).toBeGreaterThan(110_500);
    expect(d).toBeLessThan(111_500);
  });

  it('is zero for a point against itself', () => {
    expect(haversineMeters({ lng: -46.63, lat: -23.55 }, { lng: -46.63, lat: -23.55 })).toBe(0);
  });

  it('approximates the São Paulo–Rio de Janeiro great-circle distance (~357 km)', () => {
    const saoPaulo = { lng: -46.6333, lat: -23.5505 };
    const rio = { lng: -43.1729, lat: -22.9068 };
    const km = haversineMeters(saoPaulo, rio) / 1000;
    expect(km).toBeGreaterThan(350);
    expect(km).toBeLessThan(365);
  });
});

describe('lineLengthMeters', () => {
  it('measures the equator sample line at ~2226 m', () => {
    expect(lineLengthMeters(equatorLine)).toBeCloseTo(2226, -2);
  });

  it('is zero for a degenerate single-point line', () => {
    expect(lineLengthMeters({ type: 'LineString', coordinates: [[0, 0]] })).toBe(0);
  });
});

describe('nearestPointOnLine', () => {
  it('projects a point onto the middle of the line', () => {
    const result = nearestPointOnLine({ lng: 0.01, lat: 0.001 }, equatorLine);

    expect(result.point.lng).toBeCloseTo(0.01, 5);
    expect(result.point.lat).toBeCloseTo(0, 5);
    expect(result.distanceMeters).toBeGreaterThan(100);
    expect(result.distanceMeters).toBeLessThan(120);
    expect(result.fractionAlong).toBeCloseTo(0.5, 3);
  });

  it('clamps to the start vertex for a point before the line', () => {
    const result = nearestPointOnLine({ lng: -0.05, lat: 0 }, equatorLine);
    expect(result.point.lng).toBeCloseTo(0, 6);
    expect(result.fractionAlong).toBe(0);
  });

  it('clamps to the end vertex for a point past the line', () => {
    const result = nearestPointOnLine({ lng: 0.05, lat: 0 }, equatorLine);
    expect(result.point.lng).toBeCloseTo(0.02, 6);
    expect(result.fractionAlong).toBe(1);
  });

  it('handles a degenerate single-point line without dividing by zero', () => {
    const result = nearestPointOnLine(
      { lng: 0, lat: 0.001 },
      { type: 'LineString', coordinates: [[0, 0]] },
    );
    expect(result.fractionAlong).toBe(0);
    expect(Number.isFinite(result.distanceMeters)).toBe(true);
  });

  it('rejects an empty line', () => {
    expect(() => nearestPointOnLine({ lng: 0, lat: 0 }, { type: 'LineString', coordinates: [] }))
      .toThrow(RangeError);
  });
});

describe('isWithinBuffer', () => {
  it('accepts a point INSIDE the buffer (~110 m off a 500 m buffer)', () => {
    expect(isWithinBuffer({ lng: 0.01, lat: 0.001 }, equatorLine, 500)).toBe(true);
  });

  it('rejects a point OUTSIDE the buffer (~1106 m off a 500 m buffer)', () => {
    expect(isWithinBuffer({ lng: 0.01, lat: 0.01 }, equatorLine, 500)).toBe(false);
  });

  it('is inclusive at the boundary', () => {
    const { distanceMeters } = nearestPointOnLine({ lng: 0.01, lat: 0.001 }, equatorLine);
    expect(isWithinBuffer({ lng: 0.01, lat: 0.001 }, equatorLine, distanceMeters)).toBe(true);
  });

  it('rejects a non-positive buffer', () => {
    expect(() => isWithinBuffer({ lng: 0, lat: 0 }, equatorLine, 0)).toThrow(RangeError);
  });
});

describe('pointAtFraction', () => {
  it('returns the midpoint at fraction 0.5', () => {
    const p = pointAtFraction(equatorLine, 0.5);
    expect(p.lng).toBeCloseTo(0.01, 5);
    expect(p.lat).toBeCloseTo(0, 5);
  });

  it('returns the endpoints at 0 and 1', () => {
    expect(pointAtFraction(equatorLine, 0).lng).toBeCloseTo(0, 6);
    expect(pointAtFraction(equatorLine, 1).lng).toBeCloseTo(0.02, 6);
  });

  it('clamps out-of-range fractions', () => {
    expect(pointAtFraction(equatorLine, -3).lng).toBeCloseTo(0, 6);
    expect(pointAtFraction(equatorLine, 7).lng).toBeCloseTo(0.02, 6);
  });
});

describe('kmMarker', () => {
  it('returns the point ~1.113 km along the line (its midpoint)', () => {
    const p = kmMarker(equatorLine, 1.113);
    expect(p.lng).toBeCloseTo(0.01, 4);
    expect(p.lat).toBeCloseTo(0, 5);
  });

  it('clamps past the end of the line', () => {
    expect(kmMarker(equatorLine, 999).lng).toBeCloseTo(0.02, 6);
  });

  it('rejects a non-finite distance', () => {
    expect(() => kmMarker(equatorLine, Number.NaN)).toThrow(RangeError);
  });
});
