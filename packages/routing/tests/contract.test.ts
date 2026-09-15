import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  RouteAlternative,
  RouteRequest,
  RouteResult,
  RoutingProvider,
} from '../src/index.js';

/**
 * An in-memory fake provider.
 *
 * This lives in a TEST FILE ON PURPOSE. `@qualroteiro/routing` ships the
 * interface only — the real adapters (managed vendor today, self-hosted
 * Valhalla later) belong to `apps/api`. Nothing here is emitted to `dist/`,
 * which is what keeps the "no HTTP client in the build output" guarantee true.
 */
class FakeRoutingProvider implements RoutingProvider {
  public lastRequest: RouteRequest | undefined;

  async route(req: RouteRequest): Promise<RouteResult> {
    this.lastRequest = req;

    const direct: RouteAlternative = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [req.origin.lng, req.origin.lat],
          [req.destination.lng, req.destination.lat],
        ],
      },
      distanceKm: 430,
      durationMin: 330,
    };

    const scenic: RouteAlternative = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [req.origin.lng, req.origin.lat],
          [req.origin.lng + 0.5, req.origin.lat + 0.5],
          [req.destination.lng, req.destination.lat],
        ],
      },
      distanceKm: 512,
      durationMin: 402,
    };

    return { routes: [direct, scenic] };
  }
}

const saoPaulo = { lng: -46.6333, lat: -23.5505 };
const rio = { lng: -43.1729, lat: -22.9068 };

describe('RoutingProvider contract', () => {
  it('is satisfiable by an implementation that does no network I/O', async () => {
    const provider: RoutingProvider = new FakeRoutingProvider();
    const result = await provider.route({ origin: saoPaulo, destination: rio });

    expect(result.routes).toHaveLength(2);
  });

  it('describes each alternative with a GeoJSON LineString, distanceKm and durationMin', async () => {
    const provider: RoutingProvider = new FakeRoutingProvider();
    const { routes } = await provider.route({ origin: saoPaulo, destination: rio });

    for (const alternative of routes) {
      expect(alternative.geometry.type).toBe('LineString');
      expect(alternative.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(alternative.distanceKm).toBeGreaterThan(0);
      expect(alternative.durationMin).toBeGreaterThan(0);
    }
  });

  it('passes waypoints and profile through to the provider untouched', async () => {
    const provider = new FakeRoutingProvider();
    const waypoints = [{ lng: -45.8, lat: -23.2 }];

    await provider.route({
      origin: saoPaulo,
      destination: rio,
      waypoints,
      profile: 'truck',
    });

    expect(provider.lastRequest?.waypoints).toEqual(waypoints);
    expect(provider.lastRequest?.profile).toBe('truck');
  });

  it('accepts a request with neither waypoints nor profile', async () => {
    const provider: RoutingProvider = new FakeRoutingProvider();
    await expect(provider.route({ origin: saoPaulo, destination: rio })).resolves.toBeDefined();
  });
});

describe('RoutingProvider types', () => {
  it('returns a Promise, so an async vendor adapter satisfies it unchanged', () => {
    expectTypeOf<RoutingProvider['route']>().returns.toEqualTypeOf<Promise<RouteResult>>();
  });

  it('keeps `profile` an open string so vendor-specific profiles need no edit here', () => {
    expectTypeOf<RouteRequest['profile']>().toEqualTypeOf<string | undefined>();
  });
});
