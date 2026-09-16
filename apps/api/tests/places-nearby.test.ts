/**
 * `GET /places/nearby` and `GET /admin/places-usage` — G1's cost-guarded
 * Google Places search.
 *
 * The circuit-breaker test below is the most important one in this file: it
 * proves the provider is never invoked once the monthly cap is reached, not
 * merely that the response is a 503.
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { currentYearMonth } from '../src/store/api-usage.js';
import {
  fakeApiUsageStore,
  fakeGeocodeProvider,
  fakeGooglePlacesProvider,
  fakeRoutingProvider,
  fakeTollPlazaStore,
  failingGooglePlacesProvider,
} from './helpers/fakes.js';

// Computed, not hardcoded: the route keys its counter by the REAL current
// UTC month (it takes no injectable clock), so the fixture must track it too.
const YEAR_MONTH = currentYearMonth();
const SKU = 'places-nearby-search';

function appWith(opts: {
  googlePlaces?: Parameters<typeof buildApp>[0]['googlePlaces'];
  usage?: Parameters<typeof buildApp>[0]['apiUsage'];
  monthlyCap?: number;
}) {
  return buildApp({
    routing: fakeRoutingProvider(),
    geocode: fakeGeocodeProvider(),
    tollPlazas: fakeTollPlazaStore(),
    googlePlaces: opts.googlePlaces ?? fakeGooglePlacesProvider(),
    apiUsage: opts.usage ?? fakeApiUsageStore(),
    placesMonthlyCap: opts.monthlyCap ?? 4500,
  });
}

describe('GET /places/nearby', () => {
  it('returns places[] in the documented shape', async () => {
    const google = fakeGooglePlacesProvider([
      {
        id: 'p1',
        name: 'Pousada da Praia',
        address: 'Rua das Flores, 10',
        lat: -23.5,
        lng: -45.1,
        category: 'hospedagem',
      },
    ]);
    const app = appWith({ googlePlaces: google });

    const res = await app.inject({
      method: 'GET',
      url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      places: [
        {
          id: 'p1',
          name: 'Pousada da Praia',
          address: 'Rua das Flores, 10',
          lat: -23.5,
          lng: -45.1,
          category: 'hospedagem',
        },
      ],
    });
  });

  it.each(['hospedagem', 'restaurantes', 'atividades'] as const)(
    'passes category=%s through to the provider request',
    async (category) => {
      const google = fakeGooglePlacesProvider([]);
      const app = appWith({ googlePlaces: google });

      await app.inject({
        method: 'GET',
        url: `/places/nearby?lat=-23.5&lng=-45.1&category=${category}`,
      });

      expect(google.calls).toHaveLength(1);
      expect(google.calls[0]?.category).toBe(category);
    },
  );

  it('defaults radiusMeters to 3000 when absent', async () => {
    const google = fakeGooglePlacesProvider([]);
    const app = appWith({ googlePlaces: google });

    await app.inject({ method: 'GET', url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem' });

    expect(google.calls[0]?.radiusMeters).toBe(3000);
  });

  it('honours an explicit radiusMeters', async () => {
    const google = fakeGooglePlacesProvider([]);
    const app = appWith({ googlePlaces: google });

    await app.inject({
      method: 'GET',
      url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem&radiusMeters=8000',
    });

    expect(google.calls[0]?.radiusMeters).toBe(8000);
  });

  it.each([
    ['missing lat', '/places/nearby?lng=-45.1&category=hospedagem', 'lat'],
    ['missing lng', '/places/nearby?lat=-23.5&category=hospedagem', 'lng'],
    ['missing category', '/places/nearby?lat=-23.5&lng=-45.1', 'category'],
    ['non-numeric lat', '/places/nearby?lat=abc&lng=-45.1&category=hospedagem', 'lat'],
    ['lat out of range', '/places/nearby?lat=999&lng=-45.1&category=hospedagem', 'lat'],
    ['lng out of range', '/places/nearby?lat=-23.5&lng=999&category=hospedagem', 'lng'],
    [
      'category outside the enum',
      '/places/nearby?lat=-23.5&lng=-45.1&category=passeios',
      'category',
    ],
    [
      'non-positive radiusMeters',
      '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem&radiusMeters=0',
      'radiusMeters',
    ],
  ])('rejects %s with 400 naming the field', async (_label, url, field) => {
    const app = appWith({});

    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(new RegExp(`\\b${field}\\b`));
  });

  it('returns 502 when the Google Places provider fails', async () => {
    const app = appWith({ googlePlaces: failingGooglePlacesProvider(new Error('places down')) });

    const res = await app.inject({
      method: 'GET',
      url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
    });

    expect(res.statusCode).toBe(502);
  });

  describe('circuit breaker', () => {
    it('refuses with 503 WITHOUT ever calling the provider once the monthly cap is reached', async () => {
      const google = fakeGooglePlacesProvider([]);
      const usage = fakeApiUsageStore({ [`${SKU}|${YEAR_MONTH}`]: 10 });
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(),
        googlePlaces: google,
        apiUsage: usage,
        placesMonthlyCap: 10,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBeTypeOf('string');
      // The critical assertion: the provider was never invoked.
      expect(google.calls).toHaveLength(0);
    });

    it('still allows the call when the count is one below the cap', async () => {
      const google = fakeGooglePlacesProvider([]);
      const usage = fakeApiUsageStore({ [`${SKU}|${YEAR_MONTH}`]: 9 });
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(),
        googlePlaces: google,
        apiUsage: usage,
        placesMonthlyCap: 10,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
      });

      expect(res.statusCode).toBe(200);
      expect(google.calls).toHaveLength(1);
    });

    it('increments the counter after a successful call', async () => {
      const usage = fakeApiUsageStore({ [`${SKU}|${YEAR_MONTH}`]: 3 });
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(),
        googlePlaces: fakeGooglePlacesProvider([]),
        apiUsage: usage,
        placesMonthlyCap: 4500,
      });

      await app.inject({
        method: 'GET',
        url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
      });

      expect(await usage.getCount(SKU, YEAR_MONTH)).toBe(4);
    });

    it('does NOT increment the counter when the provider call fails', async () => {
      const usage = fakeApiUsageStore({ [`${SKU}|${YEAR_MONTH}`]: 3 });
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(),
        googlePlaces: failingGooglePlacesProvider(new Error('places down')),
        apiUsage: usage,
        placesMonthlyCap: 4500,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
      });

      expect(res.statusCode).toBe(502);
      expect(await usage.getCount(SKU, YEAR_MONTH)).toBe(3);
    });

    it('keys the counter by the calendar month the request happened in', async () => {
      // The route uses the real clock when `now` is not injected — this test
      // proves it reads/writes SOME real current-month key, by round-tripping
      // through the same route (not a fixed fixture month).
      const usage = fakeApiUsageStore();
      const app = buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        tollPlazas: fakeTollPlazaStore(),
        googlePlaces: fakeGooglePlacesProvider([]),
        apiUsage: usage,
        placesMonthlyCap: 4500,
      });

      await app.inject({
        method: 'GET',
        url: '/places/nearby?lat=-23.5&lng=-45.1&category=hospedagem',
      });

      const rows = await usage.listAll();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sku).toBe(SKU);
      expect(rows[0]?.count).toBe(1);
      expect(rows[0]?.yearMonth).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

describe('GET /admin/places-usage', () => {
  it('returns the current counter with its configured cap', async () => {
    const usage = fakeApiUsageStore({ [`${SKU}|${YEAR_MONTH}`]: 42 });
    const app = buildApp({
      routing: fakeRoutingProvider(),
      geocode: fakeGeocodeProvider(),
      tollPlazas: fakeTollPlazaStore(),
      googlePlaces: fakeGooglePlacesProvider([]),
      apiUsage: usage,
      placesMonthlyCap: 4500,
    });

    const res = await app.inject({ method: 'GET', url: '/admin/places-usage' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      usage: [{ sku: SKU, yearMonth: YEAR_MONTH, count: 42, cap: 4500 }],
    });
  });

  it('returns an empty list when nothing has been counted yet', async () => {
    const app = appWith({ usage: fakeApiUsageStore() });

    const res = await app.inject({ method: 'GET', url: '/admin/places-usage' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ usage: [] });
  });

  it('requires no Authorization header (deliberately unauthenticated in this unit)', async () => {
    const app = appWith({ usage: fakeApiUsageStore({ [`${SKU}|${YEAR_MONTH}`]: 1 }) });

    const res = await app.inject({ method: 'GET', url: '/admin/places-usage' });

    expect(res.statusCode).toBe(200);
  });
});
