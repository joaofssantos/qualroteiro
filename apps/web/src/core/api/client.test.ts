import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, planRoute, searchPlaces } from './client';
import type { PlanRouteRequest } from './types';

/** Install a `fetch` double and hand back the calls it recorded. */
function mockFetch(responder: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return responder(url, init);
  });
  vi.stubGlobal('fetch', spy);
  return calls;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const REQUEST: PlanRouteRequest = {
  origin: { lng: -46.6333, lat: -23.5505 },
  destination: 'Rio de Janeiro, RJ',
  waypoints: [],
  vehicle: { type: 'car', axleCategory: 'car', consumptionKmPerL: 10 },
  fuelPricePerL: 6,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('planRoute', () => {
  it('POSTs the contract body to /api/routes/plan and returns the alternatives', async () => {
    const calls = mockFetch(() =>
      json({
        routes: [
          {
            geometry: { type: 'LineString', coordinates: [[-46.6, -23.5]] },
            distanceKm: 429.7,
            durationMin: 342.5,
            tolls: { plazas: [], total: 52.9 },
            fuel: { liters: 42.97, cost: 257.82 },
            points: { tolls: [], fuelStations: [] },
          },
        ],
      }),
    );

    const routes = await planRoute(REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/routes/plan');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(REQUEST);
    expect(routes).toHaveLength(1);
    expect(routes[0]?.distanceKm).toBe(429.7);
  });

  it('maps 422 to an unresolved-place error attributed to the named field', async () => {
    mockFetch(() => json({ error: "destination: no place found for 'Rio de Janiro'" }, 422));

    const error = await planRoute(REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.kind).toBe('unresolved-place');
    expect(apiError.field).toBe('destination');
  });

  it('attributes a 422 on a stop to that stop', async () => {
    mockFetch(() => json({ error: "waypoints[1]: no place found for 'xyz'" }, 422));

    const error = (await planRoute(REQUEST).catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe('unresolved-place');
    expect(error.field).toBe('waypoints[1]');
  });

  it('maps 400 to a validation error, not an unresolved-place one', async () => {
    mockFetch(() => json({ error: 'destination is required' }, 400));

    const error = (await planRoute(REQUEST).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(400);
    expect(error.kind).toBe('validation');
  });

  it('maps 502 to a provider error', async () => {
    mockFetch(() => json({ error: 'routing provider failed' }, 502));

    const error = (await planRoute(REQUEST).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.kind).toBe('provider');
  });

  it('maps a transport failure to a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    const error = (await planRoute(REQUEST).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('network');
  });
});

describe('searchPlaces', () => {
  it('GETs /api/places/search with the query encoded', async () => {
    const calls = mockFetch(() =>
      json({ places: [{ id: '1', label: 'São Paulo, SP', lng: -46.6, lat: -23.5 }] }),
    );

    const places = await searchPlaces('São Paulo');

    expect(calls[0]?.url).toBe(`/api/places/search?q=${encodeURIComponent('São Paulo')}`);
    expect(places[0]?.label).toBe('São Paulo, SP');
  });

  it('passes an AbortSignal through so a superseded search can be cancelled', async () => {
    const calls = mockFetch(() => json({ places: [] }));
    const controller = new AbortController();

    await searchPlaces('sp', controller.signal);

    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });
});
