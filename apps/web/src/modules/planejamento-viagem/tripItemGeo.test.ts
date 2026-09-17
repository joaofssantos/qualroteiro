import { describe, expect, it } from 'vitest';

import type { TripItem } from '@/core/api/trips';
import { DUTRA_ROUTE, PLAN_QUERY_FIXTURE, SAO_PAULO } from '@/test/fixtures';

import { extractSavedRoute, extractTripItemCoordinate } from './tripItemGeo';

function item(overrides: Partial<TripItem>): TripItem {
  return {
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'hospedagem',
    kind: 'stay',
    title: 'Item',
    payload: {},
    costEstimate: null,
    ...overrides,
  };
}

describe('extractTripItemCoordinate', () => {
  it.each(['hospedagem', 'restaurantes', 'atividades'] as const)(
    'reads flat lat/lng for a %s item',
    (moduleId) => {
      const result = extractTripItemCoordinate(
        item({ moduleId, payload: { lat: -22.9, lng: -43.2, other: 'field' } }),
      );
      expect(result).toEqual({ lat: -22.9, lng: -43.2 });
    },
  );

  it.each(['hospedagem', 'restaurantes', 'atividades'] as const)(
    'returns null for a %s item with lat/lng null (manual entry)',
    (moduleId) => {
      expect(extractTripItemCoordinate(item({ moduleId, payload: { lat: null, lng: null } }))).toBeNull();
    },
  );

  it('returns null for a payload missing lat/lng entirely (saved before Wave 1)', () => {
    expect(extractTripItemCoordinate(item({ moduleId: 'hospedagem', payload: { placeName: 'Hotel' } }))).toBeNull();
  });

  it('reads the geocoded query.origin for a rota-custos item with a saved query', () => {
    const payload = { ...DUTRA_ROUTE, query: PLAN_QUERY_FIXTURE };
    const result = extractTripItemCoordinate(item({ moduleId: 'rota-custos', kind: 'route', payload }));
    expect(result).toEqual({ lat: SAO_PAULO.lat, lng: SAO_PAULO.lng });
  });

  it('returns null for a rota-custos item with no query at all (pre-Wave-2 payload)', () => {
    const payload = { ...DUTRA_ROUTE };
    expect('query' in payload).toBe(false);
    expect(extractTripItemCoordinate(item({ moduleId: 'rota-custos', kind: 'route', payload }))).toBeNull();
  });

  it('returns null for a rota-custos item whose query.origin is free text (not geocoded)', () => {
    const payload = {
      ...DUTRA_ROUTE,
      query: { ...PLAN_QUERY_FIXTURE, origin: 'São Paulo, SP' },
    };
    expect(extractTripItemCoordinate(item({ moduleId: 'rota-custos', kind: 'route', payload }))).toBeNull();
  });

  it('returns null for an unrecognized moduleId, never throws', () => {
    expect(extractTripItemCoordinate(item({ moduleId: 'frete', payload: { lat: 1, lng: 2 } }))).toBeNull();
  });

  it('returns null (not throws) for a non-object payload', () => {
    expect(extractTripItemCoordinate(item({ moduleId: 'hospedagem', payload: 'not-an-object' }))).toBeNull();
    expect(extractTripItemCoordinate(item({ moduleId: 'rota-custos', kind: 'route', payload: null }))).toBeNull();
  });
});

describe('extractSavedRoute', () => {
  it('returns the route and query for a Wave-2-shaped payload', () => {
    const payload = { ...DUTRA_ROUTE, query: PLAN_QUERY_FIXTURE };
    const result = extractSavedRoute(item({ moduleId: 'rota-custos', kind: 'route', payload }));
    // `route` is the payload with `query` split back out — exactly the shape
    // `/routes/plan` would have returned, no stray `query` key riding along.
    expect(result).toEqual({ route: DUTRA_ROUTE, query: PLAN_QUERY_FIXTURE });
  });

  it('returns null for a payload with no query (pre-Wave-2)', () => {
    const payload = { ...DUTRA_ROUTE };
    expect(extractSavedRoute(item({ moduleId: 'rota-custos', kind: 'route', payload }))).toBeNull();
  });

  it('returns null for a non-rota-custos item even if the payload happens to look route-shaped', () => {
    const payload = { ...DUTRA_ROUTE, query: PLAN_QUERY_FIXTURE };
    expect(extractSavedRoute(item({ moduleId: 'hospedagem', payload }))).toBeNull();
  });

  it('returns null when query is present but malformed', () => {
    const payload = { ...DUTRA_ROUTE, query: { origin: PLAN_QUERY_FIXTURE.origin } };
    expect(extractSavedRoute(item({ moduleId: 'rota-custos', kind: 'route', payload }))).toBeNull();
  });

  it('returns null when the route fields themselves are missing', () => {
    const payload = { query: PLAN_QUERY_FIXTURE };
    expect(extractSavedRoute(item({ moduleId: 'rota-custos', kind: 'route', payload }))).toBeNull();
  });
});
