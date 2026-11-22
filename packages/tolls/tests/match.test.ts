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

const artespImigrantes2: TollPlaza = { id: 'artesp-free-flow-sp-021-imigrantes-2', name: 'ARTESP Imigrantes 2', concessionaire: 'Ecovias Imigrantes', highway: 'SP-021', km: 0, lat: -23.7180391, lng: -46.6059124, source: 'artesp', tariffByAxleCategory: { motorcycle: 2.7, car: 5.4, car_with_trailer: 5.4, truck_2_axle: 10.8, truck_3_axle: 16.2, truck_4_axle: 21.6, truck_5_axle: 27, truck_6_axle: 32.4 } };

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
  it('counts one physical plaza when the source contains many co-located toll points', () => {
    // Regression fixture from the live SP→RJ response: the ANTT feed exposed
    // several Free Flow lane/sensor records for each physical charge point.
    // Before de-duplication this shape made the 405 km route return dozens of
    // "plazas" despite there being only six physical points in this fixture.
    const physicalPoints = dutra.plazas.slice(0, 6);
    const duplicatedSourceRows = physicalPoints.flatMap((plaza, pointIndex) =>
      Array.from({ length: pointIndex === 0 ? 20 : 10 }, (_, duplicateIndex) => ({
        ...plaza,
        id: `live-sp-rj-${pointIndex}-${duplicateIndex}`,
        name: `${plaza.name} lane ${duplicateIndex + 1}`,
      })),
    );

    expect(duplicatedSourceRows).toHaveLength(70);

    const { plazas, total } = matchTolls({
      routeGeometry: dutraPolyline,
      axleCategory: 'car',
      plazas: duplicatedSourceRows,
    });

    expect(plazas).toHaveLength(6);
    expect(total).toBeCloseTo(
      physicalPoints.reduce((sum, plaza) => sum + (plaza.tariffByAxleCategory?.car ?? 0), 0),
      2,
    );
  });

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

describe('matchTolls — ARTESP Free Flow precedence', () => {
  it('keeps ARTESP R$5,40 even when a co-located OSM node is a few metres closer to the route', () => {
    const staleOsm: TollPlaza = { ...artespImigrantes2, id: 'osm-656016287', name: 'OSM Imigrantes 2', source: 'osm', lat: -23.71803, tariffByAxleCategory: { ...artespImigrantes2.tariffByAxleCategory!, car: 6 } };
    // ARTESP is ~1 m north of this route, while the OSM node is almost on it.
    const route: LineString = { type: 'LineString', coordinates: [[-46.6065, -23.71803], [-46.6052, -23.71803]] };
    const result = matchTolls({ routeGeometry: route, axleCategory: 'car', plazas: [staleOsm, artespImigrantes2] });
    expect(result.plazas.map((plaza) => plaza.id)).toEqual(['artesp-free-flow-sp-021-imigrantes-2']);
    expect(result.total).toBe(5.4);
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

  it('keeps the tariffed record when a tariff-less source mirrors the same physical plaza', () => {
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

    expect(withUntariffed.plazas).toHaveLength(tariffedOnly.plazas.length);
    expect(withUntariffed.plazas.some((p) => p.id === untariffed.id)).toBe(false);
    expect(withUntariffed.total).toBe(tariffedOnly.total);
  });

  it('prefers a tariffed co-located record even when the tariff-less record is closer to the route', () => {
    const route: LineString = {
      type: 'LineString',
      coordinates: [
        [-46, -23],
        [-45.99, -23],
      ],
    };
    const base: Omit<TollPlaza, 'id' | 'lat' | 'tariffByAxleCategory'> = {
      name: 'Praça co-localizada',
      concessionaire: 'Concessionária Teste',
      highway: 'BR-000',
      km: 10,
      lng: -45.995,
    };
    const noTariff: TollPlaza = { ...base, id: 'antt-no-tariff', lat: -23 };
    // About 33 m from the route, but only 33 m from the ANTT point.
    const tariffed: TollPlaza = {
      ...base,
      id: 'osm-car-10',
      lat: -23.0003,
      tariffByAxleCategory: {
        motorcycle: 5,
        car: 10,
        car_with_trailer: 15,
        truck_2_axle: 20,
        truck_3_axle: 25,
        truck_4_axle: 30,
        truck_5_axle: 35,
        truck_6_axle: 40,
      },
    };

    const result = matchTolls({
      routeGeometry: route,
      axleCategory: 'car',
      plazas: [noTariff, tariffed],
    });

    expect(result.plazas.map((plaza) => plaza.id)).toEqual(['osm-car-10']);
    expect(result.total).toBe(10);
  });
});

describe('matchTolls — co-located plaza tie-breaking', () => {
  const route: LineString = {
    type: 'LineString',
    coordinates: [
      [-46, -23],
      [-45.99, -23],
    ],
  };
  const tariff = (car: number) => ({
    motorcycle: car / 2,
    car,
    car_with_trailer: car * 1.5,
    truck_2_axle: car * 2,
    truck_3_axle: car * 2.5,
    truck_4_axle: car * 3,
    truck_5_axle: car * 3.5,
    truck_6_axle: car * 4,
  });
  const plaza = (id: string, lng: number, lat: number, car = 10): TollPlaza => ({
    id,
    name: `Praça ${id}`,
    concessionaire: 'Concessionária Teste',
    highway: 'BR-000',
    km: 10,
    lng,
    lat,
    tariffByAxleCategory: tariff(car),
  });

  it('gives the same result for every order of a three-gantry chain', () => {
    // Each adjacent pair is about 80 m apart. A and C are farther than the
    // 100 m de-duplication radius, so this must remain two charge points.
    const chain = [
      plaza('p0', -45.998, -23),
      plaza('p1', -45.99722, -23),
      plaza('p2', -45.99644, -23),
    ];
    const permutations = [
      [chain[0]!, chain[1]!, chain[2]!],
      [chain[0]!, chain[2]!, chain[1]!],
      [chain[1]!, chain[0]!, chain[2]!],
      [chain[1]!, chain[2]!, chain[0]!],
      [chain[2]!, chain[0]!, chain[1]!],
      [chain[2]!, chain[1]!, chain[0]!],
    ];

    for (const plazas of permutations) {
      expect(matchTolls({ routeGeometry: route, axleCategory: 'car', plazas })).toMatchObject({
        plazas: [{ id: 'p0' }, { id: 'p2' }],
        total: 20,
      });
    }
  });

  it('keeps the closer tariffed record when tariffed records disagree', () => {
    const farther = plaza('farther', -45.995, -23.0004, 20);
    const closer = plaza('closer', -45.995, -23.0001, 10);

    expect(
      matchTolls({ routeGeometry: route, axleCategory: 'car', plazas: [farther, closer] }),
    ).toMatchObject({ plazas: [{ id: 'closer' }], total: 10 });
  });

  it('uses the id to break an exact distance tie between tariffed records', () => {
    const laterId = plaza('z-record', -45.995, -23.0002, 20);
    const earlierId = plaza('a-record', -45.995, -23.0002, 10);

    expect(
      matchTolls({ routeGeometry: route, axleCategory: 'car', plazas: [laterId, earlierId] }),
    ).toMatchObject({ plazas: [{ id: 'a-record' }], total: 10 });
  });

  it('treats a tariff table missing the requested category as unpriced', () => {
    const { car: _car, ...withoutCar } = tariff(10);
    const noCarTariff: TollPlaza = {
      ...plaza('no-car-tariff', -45.995, -23, 10),
      tariffByAxleCategory: withoutCar as TollPlaza['tariffByAxleCategory'],
    };
    const carTariff = plaza('has-car-tariff', -45.995, -23.0003, 10);

    expect(
      matchTolls({ routeGeometry: route, axleCategory: 'car', plazas: [noCarTariff, carTariff] }),
    ).toMatchObject({ plazas: [{ id: 'has-car-tariff' }], total: 10 });
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
