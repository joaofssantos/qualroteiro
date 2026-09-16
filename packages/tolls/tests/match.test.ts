import type { LineString } from '@qualroteiro/geo';
import { describe, expect, it } from 'vitest';

import {
  TOLL_MATCH_BUFFER_METERS,
  corridorPolyline,
  getCorridor,
  listCorridors,
  matchTolls,
} from '../src/index.js';
import type { TollPlaza } from '../src/index.js';

const dutra = getCorridor('sp-rj-dutra');
const dutraPolyline = corridorPolyline('sp-rj-dutra');
const bandeirantes = getCorridor('sp-campinas-bandeirantes');

/** Every plaza across the three demo corridors — the caller-assembled candidate list. */
const allPlazas: readonly TollPlaza[] = listCorridors().flatMap((c) => c.plazas);

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
    const { plazas } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });

    expect(plazas.map((p) => p.id).sort()).toEqual(dutra.plazas.map((p) => p.id).sort());
  });

  it('gives every matched plaza a car tariff greater than zero', () => {
    const { plazas } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });

    expect(plazas.length).toBeGreaterThan(0);
    for (const plaza of plazas) {
      expect(plaza.tariffByAxleCategory?.car).toBeGreaterThan(0);
    }
  });

  it('totals exactly the sum of the matched plazas car tariffs', () => {
    const { plazas, total } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });

    const expected = plazas.reduce((sum, p) => sum + (p.tariffByAxleCategory?.car ?? 0), 0);
    expect(total).toBeCloseTo(expected, 2);
  });

  it('matches the seed snapshot total for a car on the Dutra corridor', () => {
    const { total } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });
    // Sum of the six seeded car fares. Update deliberately if the seed changes.
    expect(total).toBe(52.9);
  });

  it('charges a 6-axle truck more than a car over the same route', () => {
    const car = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });
    const truck = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'truck_6_axle',
      plazas: allPlazas,
    });

    expect(truck.plazas).toHaveLength(car.plazas.length);
    expect(truck.total).toBeGreaterThan(car.total);
  });

  it('returns plazas ordered along the route, not in seed order', () => {
    const { plazas } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });
    const kms = plazas.map((p) => p.km);

    expect(kms).toEqual([...kms].sort((a, b) => a - b));
  });

  it('does not pick up plazas from the other two corridors', () => {
    const { plazas } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });
    const foreign = plazas.filter(
      (p) => !dutra.plazas.some((seeded) => seeded.id === p.id),
    );

    expect(foreign).toEqual([]);
  });
});

describe('matchTolls — a route that passes nothing', () => {
  it('returns no plazas and a zero total', () => {
    expect(
      matchTolls({ routeGeometry: emptyOcean, axleCategory: 'car', plazas: allPlazas }),
    ).toEqual({
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
      plazas: allPlazas,
      bufferMeters: TOLL_MATCH_BUFFER_METERS,
    });
    const tight = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
      bufferMeters: 1,
    });

    expect(wide.plazas.length).toBeGreaterThan(0);
    expect(tight.plazas).toEqual([]);
    expect(tight.total).toBe(0);
  });

  it('rejects a non-positive buffer', () => {
    expect(() =>
      matchTolls({
        routeGeometry: dutraPolyline,
        axleCategory: 'car',
        plazas: allPlazas,
        bufferMeters: 0,
      }),
    ).toThrow(RangeError);
  });

  it('documents its default buffer as 500 m', () => {
    expect(TOLL_MATCH_BUFFER_METERS).toBe(500);
  });
});

describe('matchTolls — explicit plazas parameter', () => {
  it('narrows the candidate set to only the plazas passed in', () => {
    const restricted = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: bandeirantes.plazas,
    });

    // The Dutra route passes no Bandeirantes plaza, so restricting the
    // candidate list to Bandeirantes yields nothing — proving the caller's
    // list really did restrict the search, not the package's own resolution.
    expect(restricted.plazas).toEqual([]);
    expect(restricted.total).toBe(0);
  });

  it('gives the same answer whether the caller passes all plazas or just the matching corridor', () => {
    const narrowed = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: dutra.plazas,
    });
    const fromAll = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: allPlazas,
    });

    expect(narrowed).toEqual(fromAll);
  });
});

describe('matchTolls — plaza with no tariffByAxleCategory', () => {
  it('appears in plazas[] but contributes nothing to the total', () => {
    const untariffed: TollPlaza = {
      id: 'untariffed-test-plaza',
      name: 'Praça Sem Tarifa (teste)',
      concessionaire: 'Concessionária Teste',
      highway: 'BR-000',
      km: dutra.plazas[0]!.km,
      lat: dutra.plazas[0]!.lat,
      lng: dutra.plazas[0]!.lng,
      // tariffByAxleCategory intentionally omitted — real-world plaza not yet priced.
    };

    const { plazas, total } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: [untariffed],
    });

    expect(plazas).toEqual([untariffed]);
    expect(total).toBe(0);
  });

  it('does not affect the total contributed by tariffed plazas matched alongside it', () => {
    const untariffed: TollPlaza = {
      id: 'untariffed-test-plaza-2',
      name: 'Praça Sem Tarifa (teste 2)',
      concessionaire: 'Concessionária Teste',
      highway: 'BR-000',
      km: dutra.plazas[0]!.km,
      lat: dutra.plazas[0]!.lat,
      lng: dutra.plazas[0]!.lng,
    };

    const withUntariffed = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: [...dutra.plazas, untariffed],
    });
    const tariffedOnly = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: dutra.plazas,
    });

    expect(withUntariffed.plazas).toHaveLength(tariffedOnly.plazas.length + 1);
    expect(withUntariffed.plazas.some((p) => p.id === untariffed.id)).toBe(true);
    expect(withUntariffed.total).toBe(tariffedOnly.total);
  });
});

describe('matchTolls — degenerate input', () => {
  it('rejects an empty route geometry', () => {
    expect(() =>
      matchTolls({
        routeGeometry: { type: 'LineString', coordinates: [] },
        axleCategory: 'car',
        plazas: allPlazas,
      }),
    ).toThrow(RangeError);
  });

  it('handles the other two corridors too', () => {
    for (const id of ['sp-curitiba-regis-bittencourt', 'sp-campinas-bandeirantes'] as const) {
      const { plazas, total } = matchTolls({
        routeGeometry: corridorPolyline(id),
        axleCategory: 'car',
        plazas: allPlazas,
      });
      expect(plazas.map((p) => p.id).sort()).toEqual(
        getCorridor(id).plazas.map((p) => p.id).sort(),
      );
      expect(total).toBeGreaterThan(0);
    }
  });
});
