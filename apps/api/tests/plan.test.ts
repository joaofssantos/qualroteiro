/**
 * `POST /routes/plan` — the F1 acceptance surface.
 *
 * Every test injects fake providers through `buildApp`, so nothing here opens a
 * socket, contacts OpenRouteService, or needs a database.
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import {
  DUTRA_TOLL_PLAZA_RECORDS,
  OSM_TOLL_PLAZA_RECORD_WITH_TARIFF,
  SP_RJ_DISTANCE_KM,
  fakeGeocodeProvider,
  fakeRoutingProvider,
  fakeTollPlazaStore,
  failingRoutingProvider,
  offCorridorRoutingProvider,
} from './helpers/fakes.js';

const VALID_BODY = {
  origin: 'São Paulo, SP',
  destination: 'Rio de Janeiro, RJ',
  vehicle: { type: 'car', axleCategory: 'car', consumptionKmPerL: 10 },
  fuelPricePerL: 6,
};

type AppDeps = Parameters<typeof buildApp>[0];

/**
 * Defaults `tollPlazas` to a store seeded with plazas along the Dutra
 * geometry (`DUTRA_TOLL_PLAZA_RECORDS`) — real-store shape, but per T5 Wave 2
 * carrying no tariff — so most tests here still see matched plazas on an
 * SP→RJ route without every call site having to seed one explicitly.
 */
function appWithFakes(overrides: Partial<AppDeps> = {}) {
  return buildApp({
    routing: fakeRoutingProvider(),
    geocode: fakeGeocodeProvider(),
    tollPlazas: fakeTollPlazaStore(DUTRA_TOLL_PLAZA_RECORDS),
    ...overrides,
  });
}

describe('POST /routes/plan', () => {
  it('plans SP→RJ with real store-sourced tolls (no tariff yet) and fuel costs', async () => {
    const app = appWithFakes();
    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.routes.length).toBeGreaterThanOrEqual(1);

    const route = body.routes[0];
    expect(route.distanceKm).toBeGreaterThanOrEqual(400);
    expect(route.distanceKm).toBeLessThanOrEqual(470);

    // Real geometric match against `DUTRA_TOLL_PLAZA_RECORDS` — plazas are
    // matched and listed, but T5 Wave 2's store carries no tariff column at
    // all (see prisma/schema.prisma), so the total stays 0. This is the
    // documented, deliberate behaviour change from the old demo-seed path
    // (orientation.md decision 3): real geographic coverage now, real prices
    // in a later, separate phase.
    expect(route.tolls.plazas.length).toBeGreaterThan(0);
    expect(route.tolls.total).toBe(0);
    for (const plaza of route.tolls.plazas) {
      expect(plaza.tariffByAxleCategory).toBeUndefined();
    }

    // liters = 429.7 / 10 ; cost = that * 6, rounded to cents by @qualroteiro/fuel.
    expect(route.fuel.cost).toBeCloseTo((SP_RJ_DISTANCE_KM / 10) * 6, 2);

    expect(route.geometry.type).toBe('LineString');
    expect(route.durationMin).toBeGreaterThan(0);

    // points panel: tolls mirrored; fuelStations still real-matched against
    // the tolls package's own seeded stations (out of scope this phase — see
    // orientation.md decision 1).
    expect(route.points.tolls.length).toBe(route.tolls.plazas.length);
    expect(route.points.fuelStations.length).toBeGreaterThan(0);
    for (const station of route.points.fuelStations) {
      expect(station).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        lng: expect.any(Number),
        lat: expect.any(Number),
      });
    }
  });

  it('returns no tolls or fuel stations for a route matching no seeded/stored geometry', async () => {
    const app = buildApp({
      routing: offCorridorRoutingProvider(),
      geocode: fakeGeocodeProvider(),
      // Non-empty store, deliberately: proves the empty result comes from the
      // geometric match (the route is nowhere near these plazas), not merely
      // from an empty store.
      tollPlazas: fakeTollPlazaStore(DUTRA_TOLL_PLAZA_RECORDS),
    });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(200);
    const route = res.json().routes[0];
    expect(route.points.fuelStations).toEqual([]);
    expect(route.points.tolls).toEqual([]);
    expect(route.tolls.plazas).toEqual([]);
    expect(route.tolls.total).toBe(0);
  });

  describe('toll plazas from the store (T5 Wave 2, j-20260916-9y)', () => {
    it('matches plazas from a mocked store and does not break the total', async () => {
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(DUTRA_TOLL_PLAZA_RECORDS),
      });

      const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

      expect(res.statusCode).toBe(200);
      const route = res.json().routes[0];
      const storeIds = new Set(DUTRA_TOLL_PLAZA_RECORDS.map((r) => r.id));

      expect(route.tolls.plazas.length).toBeGreaterThan(0);
      // Every matched plaza id comes from the mocked store, and the total is
      // a real, finite number (not NaN/undefined) even though none of them
      // carry a tariff.
      for (const plaza of route.tolls.plazas) {
        expect(storeIds.has(plaza.id)).toBe(true);
      }
      expect(route.tolls.total).toBe(0);
      expect(Number.isFinite(route.tolls.total)).toBe(true);
    });

    it('works with no error and zero tolls when the table is empty (before Wave 3 ever ran)', async () => {
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(),
      });

      const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

      expect(res.statusCode).toBe(200);
      const route = res.json().routes[0];
      expect(route.tolls.plazas).toEqual([]);
      expect(route.tolls.total).toBe(0);
      expect(route.points.tolls).toEqual([]);
    });

    it('excludes an inactive plaza the store returns from listActive()', async () => {
      const inactiveOnly = DUTRA_TOLL_PLAZA_RECORDS.map((r) => ({ ...r, active: false }));
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(inactiveOnly),
      });

      const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

      expect(res.statusCode).toBe(200);
      expect(res.json().routes[0].tolls.plazas).toEqual([]);
    });
  });

  describe('OSM-sourced plazas carry a real tariff (j-20260916-y9)', () => {
    it('a source: "osm" row with tariff appears with a real tariffByAxleCategory, counting in total', async () => {
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore([OSM_TOLL_PLAZA_RECORD_WITH_TARIFF]),
      });

      const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

      expect(res.statusCode).toBe(200);
      const route = res.json().routes[0];

      expect(route.tolls.plazas).toHaveLength(1);
      const [plaza] = route.tolls.plazas;
      expect(plaza.id).toBe(OSM_TOLL_PLAZA_RECORD_WITH_TARIFF.id);
      // The real tariff round-tripped through the store's Json column and
      // toTollPlaza()'s validation — not undefined, and matches what was
      // seeded.
      expect(plaza.tariffByAxleCategory).toEqual(OSM_TOLL_PLAZA_RECORD_WITH_TARIFF.tariff);

      // VALID_BODY's vehicle.axleCategory is 'car' — the seeded tariff's
      // car rate (14.5) is what should land in total.
      expect(route.tolls.total).toBeCloseTo(14.5, 2);
    });

    it('an antt row (no tariff) keeps behaving exactly as before — zero regression from Fase 1', async () => {
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(DUTRA_TOLL_PLAZA_RECORDS),
      });

      const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

      expect(res.statusCode).toBe(200);
      const route = res.json().routes[0];

      expect(route.tolls.plazas.length).toBeGreaterThan(0);
      expect(route.tolls.total).toBe(0);
      for (const plaza of route.tolls.plazas) {
        expect(plaza.tariffByAxleCategory).toBeUndefined();
      }
    });

    it('antt and osm rows coexist — antt plazas stay tariff-less while the osm plaza contributes to total', async () => {
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore([
          ...DUTRA_TOLL_PLAZA_RECORDS,
          OSM_TOLL_PLAZA_RECORD_WITH_TARIFF,
        ]),
      });

      const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

      expect(res.statusCode).toBe(200);
      const route = res.json().routes[0];

      const anttPlazas = route.tolls.plazas.filter(
        (p: { id: string }) => p.id !== OSM_TOLL_PLAZA_RECORD_WITH_TARIFF.id,
      );
      const osmPlaza = route.tolls.plazas.find(
        (p: { id: string }) => p.id === OSM_TOLL_PLAZA_RECORD_WITH_TARIFF.id,
      );

      expect(anttPlazas.length).toBeGreaterThan(0);
      for (const plaza of anttPlazas) {
        expect(plaza.tariffByAxleCategory).toBeUndefined();
      }
      expect(osmPlaza).toBeDefined();
      expect(osmPlaza.tariffByAxleCategory).toEqual(OSM_TOLL_PLAZA_RECORD_WITH_TARIFF.tariff);

      // Only the osm plaza's car tariff feeds total — every antt plaza still
      // contributes nothing.
      expect(route.tolls.total).toBeCloseTo(14.5, 2);
    });
  });

  it('geocodes string endpoints and passes resolved coordinates to the router', async () => {
    const routing = fakeRoutingProvider();
    const geocode = fakeGeocodeProvider();
    const app = buildApp({ routing, geocode, tollPlazas: fakeTollPlazaStore() });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(200);
    expect(geocode.queries).toEqual(['São Paulo, SP', 'Rio de Janeiro, RJ']);
    expect(routing.calls[0]?.origin).toEqual({ lng: -46.6333, lat: -23.5505 });
  });

  it('accepts literal coordinates without geocoding', async () => {
    const routing = fakeRoutingProvider();
    const geocode = fakeGeocodeProvider();
    const app = buildApp({ routing, geocode, tollPlazas: fakeTollPlazaStore() });

    const res = await app.inject({
      method: 'POST',
      url: '/routes/plan',
      payload: {
        ...VALID_BODY,
        origin: { lng: -46.6333, lat: -23.5505 },
        destination: { lng: -43.1729, lat: -22.9068 },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(geocode.queries).toEqual([]);
    expect(routing.calls[0]?.destination).toEqual({ lng: -43.1729, lat: -22.9068 });
  });

  it('passes waypoints through in order', async () => {
    const routing = fakeRoutingProvider();
    const app = buildApp({ routing, geocode: fakeGeocodeProvider(), tollPlazas: fakeTollPlazaStore() });

    const res = await app.inject({
      method: 'POST',
      url: '/routes/plan',
      payload: {
        ...VALID_BODY,
        origin: { lng: -46.6333, lat: -23.5505 },
        destination: { lng: -43.1729, lat: -22.9068 },
        waypoints: [{ lng: -45.945, lat: -23.2668 }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(routing.calls[0]?.waypoints).toEqual([{ lng: -45.945, lat: -23.2668 }]);
  });

  it('rejects a body with no destination, naming the field', async () => {
    const app = appWithFakes();
    const { destination: _omitted, ...withoutDestination } = VALID_BODY;

    const res = await app.inject({
      method: 'POST',
      url: '/routes/plan',
      payload: withoutDestination,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/destination/);
  });

  it.each([
    ['vehicle missing', { ...VALID_BODY, vehicle: undefined }, /vehicle/],
    [
      'unknown axle category',
      { ...VALID_BODY, vehicle: { ...VALID_BODY.vehicle, axleCategory: 'hovercraft' } },
      /axleCategory/,
    ],
    [
      'zero consumption',
      { ...VALID_BODY, vehicle: { ...VALID_BODY.vehicle, consumptionKmPerL: 0 } },
      /consumptionKmPerL/,
    ],
    ['negative fuel price', { ...VALID_BODY, fuelPricePerL: -1 }, /fuelPricePerL/],
    ['origin of wrong type', { ...VALID_BODY, origin: 42 }, /origin/],
    ['coordinate out of range', { ...VALID_BODY, origin: { lng: -999, lat: 0 } }, /origin/],
  ])('rejects %s with 400 naming the field', async (_name, payload, expected) => {
    const app = appWithFakes();
    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(expected);
  });

  it('returns 502 when the routing provider fails', async () => {
    const app = buildApp({
      routing: failingRoutingProvider(new Error('upstream exploded')),
      geocode: fakeGeocodeProvider(),
      tollPlazas: fakeTollPlazaStore(),
    });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBeTypeOf('string');
  });

  it('returns 422 when a place string cannot be geocoded', async () => {
    const app = buildApp({
      routing: fakeRoutingProvider(),
      geocode: fakeGeocodeProvider([]),
      tollPlazas: fakeTollPlazaStore(),
    });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/origin/);
  });

  it('returns an empty routes array when the provider finds none', async () => {
    const app = buildApp({
      routing: fakeRoutingProvider({ routes: [] }),
      geocode: fakeGeocodeProvider(),
      tollPlazas: fakeTollPlazaStore(),
    });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(200);
    expect(res.json().routes).toEqual([]);
  });
});

describe('GET /health', () => {
  it('still reports ok', async () => {
    const app = appWithFakes();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('CORS', () => {
  it('is registered, so the cross-origin web app can call the API', async () => {
    const app = appWithFakes();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/routes/plan',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
    });

    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});
