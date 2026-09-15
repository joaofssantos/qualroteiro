import type { LineString } from '@qualroteiro/geo';
import { describe, expect, it } from 'vitest';

import {
  TOLL_MATCH_BUFFER_METERS,
  corridorPolyline,
  getCorridor,
  matchTolls,
} from '../src/index.js';

const dutra = getCorridor('sp-rj-dutra');
const dutraPolyline = corridorPolyline('sp-rj-dutra');

/** Somewhere in the Atlantic, well away from any seeded plaza. */
const emptyOcean: LineString = {
  type: 'LineString',
  coordinates: [
    [-30, -20],
    [-29, -19],
    [-28, -18],
  ],
};

describe('matchTolls — SP–RJ (Presidente Dutra) corridor', () => {
  it('returns exactly the Dutra plazas for the Dutra reference polyline', () => {
    const { plazas } = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });

    expect(plazas.map((p) => p.id).sort()).toEqual(dutra.plazas.map((p) => p.id).sort());
  });

  it('gives every matched plaza a car tariff greater than zero', () => {
    const { plazas } = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });

    expect(plazas.length).toBeGreaterThan(0);
    for (const plaza of plazas) {
      expect(plaza.tariffByAxleCategory.car).toBeGreaterThan(0);
    }
  });

  it('totals exactly the sum of the matched plazas car tariffs', () => {
    const { plazas, total } = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });

    const expected = plazas.reduce((sum, p) => sum + p.tariffByAxleCategory.car, 0);
    expect(total).toBeCloseTo(expected, 2);
  });

  it('matches the seed snapshot total for a car on the Dutra corridor', () => {
    const { total } = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });
    // Sum of the six seeded car fares. Update deliberately if the seed changes.
    expect(total).toBe(52.9);
  });

  it('charges a 6-axle truck more than a car over the same route', () => {
    const car = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });
    const truck = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'truck_6_axle' });

    expect(truck.plazas).toHaveLength(car.plazas.length);
    expect(truck.total).toBeGreaterThan(car.total);
  });

  it('returns plazas ordered along the route, not in seed order', () => {
    const { plazas } = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });
    const kms = plazas.map((p) => p.km);

    expect(kms).toEqual([...kms].sort((a, b) => a - b));
  });

  it('does not pick up plazas from the other two corridors', () => {
    const { plazas } = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });
    const foreign = plazas.filter(
      (p) => !dutra.plazas.some((seeded) => seeded.id === p.id),
    );

    expect(foreign).toEqual([]);
  });
});

describe('matchTolls — a route that passes nothing', () => {
  it('returns no plazas and a zero total', () => {
    expect(matchTolls({ routeGeometry: emptyOcean, axleCategory: 'car' })).toEqual({
      plazas: [],
      total: 0,
    });
  });
});

describe('matchTolls — buffer behaviour', () => {
  it('drops a plaza once the buffer is tightened below its offset from the route', () => {
    const wide = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      bufferMeters: TOLL_MATCH_BUFFER_METERS,
    });
    const tight = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      bufferMeters: 1,
    });

    expect(wide.plazas.length).toBeGreaterThan(0);
    expect(tight.plazas).toEqual([]);
    expect(tight.total).toBe(0);
  });

  it('rejects a non-positive buffer', () => {
    expect(() =>
      matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car', bufferMeters: 0 }),
    ).toThrow(RangeError);
  });

  it('documents its default buffer as 500 m', () => {
    expect(TOLL_MATCH_BUFFER_METERS).toBe(500);
  });
});

describe('matchTolls — corridorHint', () => {
  it('narrows the candidate set to the hinted corridor', () => {
    const hinted = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      corridorHint: 'sp-campinas-bandeirantes',
    });

    // The Dutra route passes no Bandeirantes plaza, so hinting the wrong
    // corridor yields nothing — proving the hint really did restrict the search.
    expect(hinted.plazas).toEqual([]);
    expect(hinted.total).toBe(0);
  });

  it('gives the same answer as an unhinted search when the hint is correct', () => {
    const hinted = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      corridorHint: 'sp-rj-dutra',
    });
    const unhinted = matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car' });

    expect(hinted).toEqual(unhinted);
  });

  it('throws for an unknown corridor hint', () => {
    expect(() =>
      // @ts-expect-error — exercising the runtime guard with an invalid id
      matchTolls({ routeGeometry: dutraPolyline, axleCategory: 'car', corridorHint: 'nope' }),
    ).toThrow(/unknown corridor/i);
  });
});

describe('matchTolls — degenerate input', () => {
  it('rejects an empty route geometry', () => {
    expect(() =>
      matchTolls({ routeGeometry: { type: 'LineString', coordinates: [] }, axleCategory: 'car' }),
    ).toThrow(RangeError);
  });

  it('handles the other two corridors too', () => {
    for (const id of ['sp-curitiba-regis-bittencourt', 'sp-campinas-bandeirantes'] as const) {
      const { plazas, total } = matchTolls({
        routeGeometry: corridorPolyline(id),
        axleCategory: 'car',
      });
      expect(plazas.map((p) => p.id).sort()).toEqual(
        getCorridor(id).plazas.map((p) => p.id).sort(),
      );
      expect(total).toBeGreaterThan(0);
    }
  });
});
