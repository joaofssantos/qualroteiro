/**
 * The demo fetch layer, unit-level.
 *
 * These handlers stand in for `apps/api` when `VITE_DEMO_MODE` is on. They must
 * mimic the WAVE 2 HTTP contract (`apps/api/specs/002-rota-custos-api/spec.md`)
 * closely enough that `client.ts` cannot tell the difference: a real `Response`,
 * the right status codes, the right error-body shape.
 */

import { describe, expect, it } from 'vitest';

import { getCorridor } from '@qualroteiro/tolls';
import { estimateFuel } from '@qualroteiro/fuel';

import type { PlanRouteRequest } from '../types';
import { demoPlanRoute, demoSearchPlaces } from './index';

const CAR: PlanRouteRequest['vehicle'] = {
  type: 'car',
  axleCategory: 'car',
  consumptionKmPerL: 10,
};

function planRequest(overrides: Partial<PlanRouteRequest> = {}): PlanRouteRequest {
  return {
    origin: 'São Paulo, SP',
    destination: 'Rio de Janeiro, RJ',
    waypoints: [],
    vehicle: CAR,
    fuelPricePerL: 6,
    ...overrides,
  };
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('demoSearchPlaces', () => {
  it('resolves the four seeded cities by case-insensitive substring on the label', async () => {
    for (const [q, label] of [
      ['são pau', 'São Paulo, SP'],
      ['SAO PAULO', 'São Paulo, SP'],
      ['rio de jan', 'Rio de Janeiro, RJ'],
      ['curitiba', 'Curitiba, PR'],
      ['campinas', 'Campinas, SP'],
    ] as const) {
      const res = await demoSearchPlaces(q);
      expect(res.status).toBe(200);
      const places = (await body(res)).places as { label: string; lng: number; lat: number }[];
      expect(places.map((p) => p.label)).toContain(label);
      expect(places[0]).toMatchObject({ lng: expect.any(Number), lat: expect.any(Number) });
    }
  });

  it('answers a blank q with 400 naming q, the same the client already handles', async () => {
    for (const q of ['', '   ']) {
      const res = await demoSearchPlaces(q);
      expect(res.status).toBe(400);
      expect(String((await body(res)).error)).toMatch(/q/);
    }
  });

  it('answers a no-match query with 200 and an empty list', async () => {
    const res = await demoSearchPlaces('Belém do Pará');
    expect(res.status).toBe(200);
    expect((await body(res)).places).toEqual([]);
  });

  it('honours an already-aborted signal the way fetch would', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(demoSearchPlaces('curitiba', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('demoPlanRoute', () => {
  it('plans SP -> RJ over the Dutra corridor with real tolls and real fuel', async () => {
    const res = await demoPlanRoute(planRequest());
    expect(res.status).toBe(200);

    const routes = (await body(res)).routes as Record<string, unknown>[];
    expect(routes).toHaveLength(1);
    const route = routes[0]!;

    expect(route.distanceKm).toBe(429.7);
    expect(route.durationMin).toBe(342.5);
    expect(route.geometry).toEqual(getCorridor('sp-rj-dutra').referencePolyline);

    const tolls = route.tolls as { plazas: { id: string }[]; total: number };
    expect(tolls.plazas.length).toBeGreaterThan(0);
    expect(tolls.plazas.map((p) => p.id).sort()).toEqual(
      getCorridor('sp-rj-dutra').plazas.map((p) => p.id).sort(),
    );
    expect(tolls.total).toBeCloseTo(
      tolls.plazas.reduce(
        (sum, p) =>
          sum +
          (getCorridor('sp-rj-dutra').plazas.find((s) => s.id === p.id)!.tariffByAxleCategory
            .car),
        0,
      ),
      2,
    );

    const expectedFuel = estimateFuel({ distanceKm: 429.7, consumptionKmPerL: 10, pricePerL: 6 });
    expect(route.fuel).toEqual({ liters: expectedFuel.liters, cost: expectedFuel.cost });
    expect((expectedFuel.liters * 6)).toBeCloseTo(expectedFuel.cost, 2);

    const points = route.points as { tolls: unknown[]; fuelStations: unknown[] };
    expect(points.fuelStations).toEqual([]);
    expect(points.tolls).toEqual(tolls.plazas);
  });

  it('plans the other two seeded corridors', async () => {
    const cases = [
      { destination: 'Curitiba, PR', id: 'sp-curitiba-regis-bittencourt', distanceKm: 408 },
      { destination: 'Campinas, SP', id: 'sp-campinas-bandeirantes', distanceKm: 96 },
    ] as const;

    for (const c of cases) {
      const res = await demoPlanRoute(planRequest({ destination: c.destination }));
      expect(res.status).toBe(200);
      const route = ((await body(res)).routes as Record<string, unknown>[])[0]!;
      expect(route.distanceKm).toBe(c.distanceKm);
      const tolls = route.tolls as { plazas: { id: string }[] };
      expect(tolls.plazas.map((p) => p.id).sort()).toEqual(
        getCorridor(c.id).plazas.map((p) => p.id).sort(),
      );
    }
  });

  it('accepts { lng, lat } coordinates for the endpoints, not only strings', async () => {
    const res = await demoPlanRoute(
      planRequest({
        origin: { lng: -46.6333, lat: -23.5505 },
        destination: { lng: -43.1729, lat: -22.9068 },
      }),
    );
    expect(res.status).toBe(200);
    expect(((await body(res)).routes as unknown[]).length).toBe(1);
  });

  it('plans the return trip too, reusing the corridor geometry reversed', async () => {
    const res = await demoPlanRoute(
      planRequest({ origin: 'Rio de Janeiro, RJ', destination: 'São Paulo, SP' }),
    );
    expect(res.status).toBe(200);
    const route = ((await body(res)).routes as Record<string, unknown>[])[0]!;
    const forward = getCorridor('sp-rj-dutra').referencePolyline.coordinates;
    expect((route.geometry as { coordinates: unknown[] }).coordinates).toEqual(
      [...forward].reverse(),
    );
  });

  it('returns a 422 naming the endpoint when a place resolves to no seeded city', async () => {
    const res = await demoPlanRoute(planRequest({ destination: 'Salvador, BA' }));
    expect(res.status).toBe(422);
    expect(String((await body(res)).error)).toMatch(/^destination:/);
  });

  it('returns a 422 prefixed destination when both cities are known but no corridor connects them', async () => {
    const res = await demoPlanRoute(
      planRequest({ origin: 'Rio de Janeiro, RJ', destination: 'Curitiba, PR' }),
    );
    expect(res.status).toBe(422);
    expect(String((await body(res)).error)).toMatch(/^destination:/);
  });
});
