/**
 * `GET /places/search` — geocoding behind the injected `GeocodeProvider`.
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import {
  fakeGeocodeProvider,
  fakeRoutingProvider,
  failingGeocodeProvider,
} from './helpers/fakes.js';

function appWith(geocode: Parameters<typeof buildApp>[0]['geocode']) {
  return buildApp({ routing: fakeRoutingProvider(), geocode });
}

describe('GET /places/search', () => {
  it('returns places for a query', async () => {
    const geocode = fakeGeocodeProvider();
    const app = appWith(geocode);

    const res = await app.inject({
      method: 'GET',
      url: `/places/search?q=${encodeURIComponent('São Paulo')}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.places.length).toBeGreaterThan(0);
    expect(body.places[0]).toMatchObject({ label: 'São Paulo' });
    expect(geocode.queries).toEqual(['São Paulo']);
  });

  it('passes an empty result through as 200 with an empty list', async () => {
    const app = appWith(fakeGeocodeProvider([]));
    const res = await app.inject({ method: 'GET', url: '/places/search?q=zzzznowhere' });

    expect(res.statusCode).toBe(200);
    expect(res.json().places).toEqual([]);
  });

  it('rejects a missing q with 400 naming the parameter', async () => {
    const app = appWith(fakeGeocodeProvider());
    const res = await app.inject({ method: 'GET', url: '/places/search' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/\bq\b/);
  });

  it('rejects a blank q with 400', async () => {
    const app = appWith(fakeGeocodeProvider());
    const res = await app.inject({ method: 'GET', url: '/places/search?q=%20%20' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/\bq\b/);
  });

  it('returns 502 when the geocoder fails', async () => {
    const app = appWith(failingGeocodeProvider(new Error('pelias down')));
    const res = await app.inject({ method: 'GET', url: '/places/search?q=São Paulo' });

    expect(res.statusCode).toBe(502);
  });
});
