/**
 * `POST /routes/plan` — the F1 acceptance surface.
 *
 * Every test injects fake providers through `buildApp`, so nothing here opens a
 * socket, contacts OpenRouteService, or needs a database.
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import {
  SP_RJ_DISTANCE_KM,
  fakeGeocodeProvider,
  fakeRoutingProvider,
  failingRoutingProvider,
} from './helpers/fakes.js';

const VALID_BODY = {
  origin: 'São Paulo, SP',
  destination: 'Rio de Janeiro, RJ',
  vehicle: { type: 'car', axleCategory: 'car', consumptionKmPerL: 10 },
  fuelPricePerL: 6,
};

type AppDeps = Parameters<typeof buildApp>[0];

function appWithFakes(overrides: Partial<AppDeps> = {}) {
  return buildApp({
    routing: fakeRoutingProvider(),
    geocode: fakeGeocodeProvider(),
    ...overrides,
  });
}

describe('POST /routes/plan', () => {
  it('plans SP→RJ with tolls and fuel costs', async () => {
    const app = appWithFakes();
    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.routes.length).toBeGreaterThanOrEqual(1);

    const route = body.routes[0];
    expect(route.distanceKm).toBeGreaterThanOrEqual(400);
    expect(route.distanceKm).toBeLessThanOrEqual(470);

    // Real geometric match against the seeded Dutra corridor.
    expect(route.tolls.plazas.length).toBeGreaterThan(0);
    expect(route.tolls.total).toBeGreaterThan(0);

    // liters = 429.7 / 10 ; cost = that * 6, rounded to cents by @qualroteiro/fuel.
    expect(route.fuel.cost).toBeCloseTo((SP_RJ_DISTANCE_KM / 10) * 6, 2);

    expect(route.geometry.type).toBe('LineString');
    expect(route.durationMin).toBeGreaterThan(0);

    // points panel: tolls mirrored, fuelStations wired but empty in F1.
    expect(route.points.tolls.length).toBe(route.tolls.plazas.length);
    expect(route.points.fuelStations).toEqual([]);
  });

  it('geocodes string endpoints and passes resolved coordinates to the router', async () => {
    const routing = fakeRoutingProvider();
    const geocode = fakeGeocodeProvider();
    const app = buildApp({ routing, geocode });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(200);
    expect(geocode.queries).toEqual(['São Paulo, SP', 'Rio de Janeiro, RJ']);
    expect(routing.calls[0]?.origin).toEqual({ lng: -46.6333, lat: -23.5505 });
  });

  it('accepts literal coordinates without geocoding', async () => {
    const routing = fakeRoutingProvider();
    const geocode = fakeGeocodeProvider();
    const app = buildApp({ routing, geocode });

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
    const app = buildApp({ routing, geocode: fakeGeocodeProvider() });

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
    });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBeTypeOf('string');
  });

  it('returns 422 when a place string cannot be geocoded', async () => {
    const app = buildApp({
      routing: fakeRoutingProvider(),
      geocode: fakeGeocodeProvider([]),
    });

    const res = await app.inject({ method: 'POST', url: '/routes/plan', payload: VALID_BODY });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/origin/);
  });

  it('returns an empty routes array when the provider finds none', async () => {
    const app = buildApp({
      routing: fakeRoutingProvider({ routes: [] }),
      geocode: fakeGeocodeProvider(),
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
