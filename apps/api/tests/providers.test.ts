/**
 * The OpenRouteService adapters, against a stubbed `fetch`.
 *
 * These prove the vendor→domain mapping (metres→km, seconds→minutes, Pelias
 * feature→Place) and the ProviderError paths, without contacting ORS.
 */

import { describe, expect, it } from 'vitest';

import { ProviderError } from '../src/errors.js';
import { createOrsGeocodeProvider } from '../src/providers/ors-geocode.js';
import { createOrsRoutingProvider } from '../src/providers/ors-routing.js';
import { jsonResponse, recordingFetch } from './helpers/recording-fetch.js';

const SP = { lng: -46.6333, lat: -23.5505 };
const RJ = { lng: -43.1729, lat: -22.9068 };

const ORS_DIRECTIONS_OK = {
  features: [
    {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-46.6333, -23.5505],
          [-43.1729, -22.9068],
        ],
      },
      // 429.7 km and 342.5 min, expressed the way ORS does: metres and seconds.
      properties: { summary: { distance: 429_700, duration: 20_550 } },
    },
  ],
};

const okDirections = (): Response => jsonResponse(ORS_DIRECTIONS_OK);

describe('createOrsRoutingProvider', () => {
  it('maps an ORS GeoJSON response to RouteResult, converting units', async () => {
    const stub = recordingFetch(okDirections);
    const provider = createOrsRoutingProvider({
      apiKey: 'test-key',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    const result = await provider.route({ origin: SP, destination: RJ, profile: 'car' });

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.distanceKm).toBeCloseTo(429.7, 3);
    expect(result.routes[0]?.durationMin).toBeCloseTo(342.5, 3);
    expect(result.routes[0]?.geometry.type).toBe('LineString');

    expect(stub.call(0).url).toBe('https://ors.example/v2/directions/driving-car/geojson');
    const headers = stub.call(0).init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('test-key');

    const body = stub.body(0);
    expect(body['coordinates']).toEqual([
      [-46.6333, -23.5505],
      [-43.1729, -22.9068],
    ]);
    // Exactly two coordinates → alternatives are requested.
    expect(body['alternative_routes']).toBeDefined();
  });

  it('selects the HGV profile for a truck', async () => {
    const stub = recordingFetch(okDirections);
    const provider = createOrsRoutingProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    await provider.route({ origin: SP, destination: RJ, profile: 'truck' });

    expect(stub.call(0).url).toContain('/driving-hgv/');
  });

  it('omits alternative_routes when waypoints make ORS reject it', async () => {
    const stub = recordingFetch(okDirections);
    const provider = createOrsRoutingProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    await provider.route({
      origin: SP,
      destination: RJ,
      waypoints: [{ lng: -45.945, lat: -23.2668 }],
    });

    const body = stub.body(0);
    expect(body['coordinates']).toHaveLength(3);
    expect(body['alternative_routes']).toBeUndefined();
  });

  it('retries once without alternatives when ORS rejects them (D-107)', async () => {
    const stub = recordingFetch(
      () => jsonResponse({ error: 'alternative_routes not supported' }, 400),
      okDirections,
    );
    const provider = createOrsRoutingProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    const result = await provider.route({ origin: SP, destination: RJ });

    expect(stub.calls).toHaveLength(2);
    expect(result.routes).toHaveLength(1);
    expect(stub.body(1)['alternative_routes']).toBeUndefined();
  });

  it('throws ProviderError on a 5xx', async () => {
    const stub = recordingFetch(() => jsonResponse({ error: 'boom' }, 503));
    const provider = createOrsRoutingProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    await expect(provider.route({ origin: SP, destination: RJ })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it('throws ProviderError when the transport fails (covers timeout)', async () => {
    const stub = recordingFetch(() => {
      throw new DOMException('The operation was aborted.', 'TimeoutError');
    });
    const provider = createOrsRoutingProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    await expect(provider.route({ origin: SP, destination: RJ })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it('throws ProviderError on a feature with no summary', async () => {
    const stub = recordingFetch(() =>
      jsonResponse({
        features: [{ geometry: { type: 'LineString', coordinates: [[0, 0]] }, properties: {} }],
      }),
    );
    const provider = createOrsRoutingProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    await expect(provider.route({ origin: SP, destination: RJ })).rejects.toThrow(/summary/);
  });
});

describe('createOrsGeocodeProvider', () => {
  it('maps Pelias features to Place[]', async () => {
    const stub = recordingFetch(() =>
      jsonResponse({
        features: [
          {
            geometry: { coordinates: [-46.6333, -23.5505] },
            properties: {
              gid: 'whosonfirst:locality:101965325',
              label: 'São Paulo, SP, Brazil',
              layer: 'locality',
            },
          },
        ],
      }),
    );

    const provider = createOrsGeocodeProvider({
      apiKey: 'test-key',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    const places = await provider.search('São Paulo');

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      id: 'whosonfirst:locality:101965325',
      label: 'São Paulo, SP, Brazil',
      lng: -46.6333,
      lat: -23.5505,
      kind: 'locality',
    });

    const calledUrl = new URL(stub.call(0).url);
    expect(calledUrl.pathname).toBe('/geocode/search');
    expect(calledUrl.searchParams.get('text')).toBe('São Paulo');
    expect(calledUrl.searchParams.get('api_key')).toBe('test-key');
    expect(calledUrl.searchParams.get('boundary.country')).toBe('BRA');
  });

  it('drops features that carry no usable coordinates', async () => {
    const stub = recordingFetch(() =>
      jsonResponse({
        features: [
          { properties: { label: 'no geometry' } },
          {
            geometry: { coordinates: [-43.1729, -22.9068] },
            properties: { label: 'Rio de Janeiro', id: 'x' },
          },
        ],
      }),
    );

    const provider = createOrsGeocodeProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    const places = await provider.search('rio');
    expect(places).toHaveLength(1);
    expect(places[0]?.label).toBe('Rio de Janeiro');
  });

  it('throws ProviderError on a non-2xx', async () => {
    const stub = recordingFetch(() => jsonResponse({ error: 'rate limited' }, 429));
    const provider = createOrsGeocodeProvider({
      apiKey: 'k',
      baseUrl: 'https://ors.example',
      fetchImpl: stub.impl,
    });

    await expect(provider.search('x')).rejects.toBeInstanceOf(ProviderError);
  });
});
