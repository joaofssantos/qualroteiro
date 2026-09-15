import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './errors';
import {
  createTrip,
  createTripDay,
  createTripItem,
  getTrip,
  listTrips,
  type Trip,
  type TripDay,
  type TripDetail,
  type TripItem,
  type TripSummary,
} from './trips';

function mockFetch(responder: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return responder(url, init);
  });
  vi.stubGlobal('fetch', spy);
  return { calls, spy };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const getToken = vi.fn(async () => 'session-token');

const TRIP: Trip = {
  id: 'trip-1',
  userId: 'user-1',
  title: 'Serra e mar',
  startDate: '2026-10-01',
  endDate: null,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
};

const TRIP_SUMMARY: TripSummary = { ...TRIP, dayCount: 1, itemCount: 2 };
const DAY: TripDay = { id: 'day-1', tripId: TRIP.id, date: '2026-10-01', order: 0 };
const ITEM: TripItem = {
  id: 'item-1',
  tripDayId: DAY.id,
  order: 0,
  moduleId: 'rota-custos',
  kind: 'route',
  title: 'São Paulo → Rio de Janeiro',
  payload: { distanceKm: 429.7 },
  costEstimate: 310.72,
};
const DETAIL: TripDetail = { ...TRIP, days: [{ ...DAY, items: [ITEM] }] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('trips API client', () => {
  it('listTrips GETs /trips with the Clerk bearer token and returns trips', async () => {
    const { calls } = mockFetch(() => json({ trips: [TRIP_SUMMARY] }));

    const trips = await listTrips(getToken);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/trips');
    expect(calls[0]?.init?.method).toBeUndefined();
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: 'Bearer session-token' });
    expect(trips).toEqual([TRIP_SUMMARY]);
  });

  it('createTrip POSTs the contract body to /trips and returns the created trip', async () => {
    const { calls } = mockFetch(() => json(TRIP, 201));
    const input = { title: 'Serra e mar', startDate: '2026-10-01', endDate: null };

    const trip = await createTrip(getToken, input);

    expect(calls[0]?.url).toBe('/api/trips');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(input);
    expect(trip).toEqual(TRIP);
  });

  it('getTrip GETs /trips/:id with the id encoded', async () => {
    const { calls } = mockFetch(() => json(DETAIL));

    const trip = await getTrip(getToken, 'trip with slash/1');

    expect(calls[0]?.url).toBe('/api/trips/trip%20with%20slash%2F1');
    expect(trip).toEqual(DETAIL);
  });

  it('createTripDay POSTs the nested day path', async () => {
    const { calls } = mockFetch(() => json(DAY, 201));
    const input = { date: '2026-10-01', order: 0 };

    const day = await createTripDay(getToken, TRIP.id, input);

    expect(calls[0]?.url).toBe('/api/trips/trip-1/days');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(input);
    expect(day).toEqual(DAY);
  });

  it('createTripItem POSTs the nested item path', async () => {
    const { calls } = mockFetch(() => json(ITEM, 201));
    const input = {
      moduleId: 'rota-custos',
      kind: 'route',
      title: ITEM.title,
      payload: ITEM.payload,
      costEstimate: ITEM.costEstimate,
    };

    const item = await createTripItem(getToken, TRIP.id, DAY.id, input);

    expect(calls[0]?.url).toBe('/api/trips/trip-1/days/day-1/items');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(input);
    expect(item).toEqual(ITEM);
  });

  it('maps a 401 response to an auth ApiError', async () => {
    mockFetch(() => json({ error: 'unauthorized' }, 401));

    const error = await listTrips(getToken).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('auth');
    expect((error as ApiError).status).toBe(401);
  });

  it('maps a generic non-OK response to a server ApiError with the API message', async () => {
    mockFetch(() => json({ error: 'database unavailable' }, 500));

    const error = await listTrips(getToken).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('server');
    expect((error as ApiError).message).toBe('database unavailable');
  });

  it('throws an auth ApiError before fetch when Clerk returns no token', async () => {
    const { spy } = mockFetch(() => json({ trips: [] }));

    const error = await listTrips(async () => null).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('auth');
    expect((error as ApiError).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });
});
