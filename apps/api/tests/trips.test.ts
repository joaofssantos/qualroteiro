/**
 * `/trips*` — the F2a acceptance surface.
 *
 * Every test injects a fake auth verifier and an in-memory store through
 * `buildApp`, so nothing here contacts Clerk or opens a database connection.
 * The handlers, routing, validation, error mapping and ownership scoping are
 * all the production ones.
 *
 * Criteria references are to specs/005-f2a-trips/spec.md.
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { fakeGeocodeProvider, fakeRoutingProvider } from './helpers/fakes.js';
import { fakeAuthVerifier, inMemoryTripStore } from './helpers/trip-fakes.js';

const ANA = 'user_ana';
const BRUNO = 'user_bruno';

const asAna = { authorization: 'Bearer token-ana' };
const asBruno = { authorization: 'Bearer token-bruno' };

function appWithTrips() {
  return buildApp({
    routing: fakeRoutingProvider(),
    geocode: fakeGeocodeProvider(),
    auth: fakeAuthVerifier({ 'token-ana': ANA, 'token-bruno': BRUNO }),
    trips: inMemoryTripStore(),
  });
}

type App = ReturnType<typeof appWithTrips>;

/** Create a trip and return its body, failing loudly if the create failed. */
async function createTrip(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown> = { title: 'Litoral Norte' },
) {
  const res = await app.inject({ method: 'POST', url: '/trips', headers, payload });
  expect(res.statusCode).toBe(201);
  return res.json();
}

const ROUTE_PAYLOAD = {
  distanceKm: 429.7,
  tolls: { total: 38.4 },
  fuel: { cost: 257.82 },
};

describe('auth on /trips* (AC-5, AC-6)', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await appWithTrips().inject({ method: 'GET', url: '/trips' });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: expect.any(String) });
  });

  it('rejects an invalid or expired token', async () => {
    const res = await appWithTrips().inject({
      method: 'GET',
      url: '/trips',
      headers: { authorization: 'Bearer not-a-real-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const res = await appWithTrips().inject({
      method: 'GET',
      url: '/trips',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('guards every /trips* route, not just the collection', async () => {
    const app = appWithTrips();
    const routes = [
      { method: 'POST' as const, url: '/trips' },
      { method: 'GET' as const, url: '/trips/trip_0001' },
      { method: 'PATCH' as const, url: '/trips/trip_0001' },
      { method: 'DELETE' as const, url: '/trips/trip_0001' },
      { method: 'POST' as const, url: '/trips/trip_0001/days' },
      { method: 'POST' as const, url: '/trips/trip_0001/days/day_0002/items' },
      { method: 'DELETE' as const, url: '/trips/trip_0001/days/day_0002/items/item_0003' },
    ];

    for (const route of routes) {
      const res = await app.inject({ ...route, payload: {} });
      expect.soft(res.statusCode, `${route.method} ${route.url}`).toBe(401);
    }
  });

  it('leaves F1 anonymous — no token required for plan, places or health (AC-15)', async () => {
    const app = appWithTrips();

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    const places = await app.inject({ method: 'GET', url: '/places/search?q=São Paulo' });
    expect(places.statusCode).toBe(200);

    const plan = await app.inject({
      method: 'POST',
      url: '/routes/plan',
      payload: {
        origin: 'São Paulo, SP',
        destination: 'Rio de Janeiro, RJ',
        vehicle: { type: 'car', axleCategory: 'car', consumptionKmPerL: 10 },
        fuelPricePerL: 6,
      },
    });
    expect(plan.statusCode).toBe(200);
  });
});

describe('POST /trips (AC-1, AC-2)', () => {
  it('creates a trip owned by the caller', async () => {
    const app = appWithTrips();
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: asAna,
      payload: { title: 'Litoral Norte', startDate: '2026-10-01', endDate: '2026-10-05' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(String),
      userId: ANA,
      title: 'Litoral Norte',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('accepts a trip with no dates at all', async () => {
    const trip = await createTrip(appWithTrips(), asAna, { title: 'Algum dia' });
    expect(trip.startDate).toBeNull();
    expect(trip.endDate).toBeNull();
  });

  it('trims the title', async () => {
    const trip = await createTrip(appWithTrips(), asAna, { title: '  Litoral Norte  ' });
    expect(trip.title).toBe('Litoral Norte');
  });

  it.each([
    ['a blank title', { title: '   ' }, 'title'],
    ['a missing title', {}, 'title'],
    ['a non-string title', { title: 42 }, 'title'],
    ['a malformed date', { title: 'X', startDate: '2026-2-1' }, 'startDate'],
    ['an impossible date', { title: 'X', startDate: '2026-02-30' }, 'startDate'],
    [
      'an end before the start',
      { title: 'X', startDate: '2026-10-05', endDate: '2026-10-01' },
      'endDate',
    ],
  ])('rejects %s with a 400 naming the field', async (_label, payload, field) => {
    const res = await appWithTrips().inject({
      method: 'POST',
      url: '/trips',
      headers: asAna,
      payload,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toEqual({ error: expect.any(String) });
    expect(body.error).toContain(field);
  });

  it('rejects a title longer than the 200-character cap (D-501)', async () => {
    const res = await appWithTrips().inject({
      method: 'POST',
      url: '/trips',
      headers: asAna,
      payload: { title: 'a'.repeat(201) },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('title');
  });

  it('accepts a title exactly at the cap', async () => {
    const trip = await createTrip(appWithTrips(), asAna, { title: 'a'.repeat(200) });
    expect(trip.title).toHaveLength(200);
  });

  it('reports every invalid field at once, not just the first', async () => {
    const res = await appWithTrips().inject({
      method: 'POST',
      url: '/trips',
      headers: asAna,
      payload: { title: '  ', startDate: 'nope' },
    });

    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error).toContain('title');
    expect(error).toContain('startDate');
  });
});

describe('GET /trips (AC-3)', () => {
  it("returns only the caller's trips, with day and item counts", async () => {
    const app = appWithTrips();

    const trip = await createTrip(app, asAna, { title: 'Litoral Norte' });
    await createTrip(app, asBruno, { title: 'Serra Gaúcha' });

    const day = await app
      .inject({ method: 'POST', url: `/trips/${trip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());
    await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: {
        moduleId: 'rota-custos',
        kind: 'route',
        title: 'São Paulo → Rio de Janeiro',
        payload: ROUTE_PAYLOAD,
      },
    });

    const res = await app.inject({ method: 'GET', url: '/trips', headers: asAna });

    expect(res.statusCode).toBe(200);
    const { trips } = res.json();
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({
      id: trip.id,
      userId: ANA,
      title: 'Litoral Norte',
      dayCount: 1,
      itemCount: 1,
    });
  });

  it('returns an empty list for a user with no trips', async () => {
    const res = await appWithTrips().inject({ method: 'GET', url: '/trips', headers: asAna });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ trips: [] });
  });
});

describe('the full flow: trip → day → item → GET (AC-14, AC-4, AC-11)', () => {
  it('returns everything nested', async () => {
    const app = appWithTrips();

    const trip = await createTrip(app, asAna, {
      title: 'Litoral Norte',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
    });

    const dayRes = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days`,
      headers: asAna,
      payload: { date: '2026-10-01' },
    });
    expect(dayRes.statusCode).toBe(201);
    const day = dayRes.json();
    expect(day).toEqual({
      id: expect.any(String),
      tripId: trip.id,
      date: '2026-10-01',
      order: 0,
    });

    const itemRes = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: {
        moduleId: 'rota-custos',
        kind: 'route',
        title: 'São Paulo → Rio de Janeiro',
        payload: ROUTE_PAYLOAD,
        costEstimate: 296.22,
      },
    });
    expect(itemRes.statusCode).toBe(201);
    expect(itemRes.json()).toEqual({
      id: expect.any(String),
      tripDayId: day.id,
      order: 0,
      moduleId: 'rota-custos',
      kind: 'route',
      title: 'São Paulo → Rio de Janeiro',
      payload: ROUTE_PAYLOAD,
      costEstimate: 296.22,
    });

    const detail = await app.inject({ method: 'GET', url: `/trips/${trip.id}`, headers: asAna });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual({
      id: trip.id,
      userId: ANA,
      title: 'Litoral Norte',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      days: [{ ...day, items: [itemRes.json()] }],
    });
  });

  it('round-trips a deeply nested payload unchanged', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);
    const day = await app
      .inject({ method: 'POST', url: `/trips/${trip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());

    const payload = {
      geometry: { type: 'LineString', coordinates: [[-46.6, -23.5], [-43.2, -22.9]] },
      nested: { deep: { flag: true, list: [1, 2, 3], nothing: null } },
    };

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: { moduleId: 'rota-custos', kind: 'route', title: 'SP → RJ', payload },
    });

    expect(res.json().payload).toEqual(payload);
  });

  it('returns a trip with no days as an empty array, not null', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    const res = await app.inject({ method: 'GET', url: `/trips/${trip.id}`, headers: asAna });
    expect(res.json().days).toEqual([]);
  });
});

describe('isolation between users (AC-7, AC-13)', () => {
  it("hides another user's trip behind the same 404 as a nonexistent one", async () => {
    const app = appWithTrips();
    const anasTrip = await createTrip(app, asAna, { title: 'Litoral Norte' });

    const stolen = await app.inject({
      method: 'GET',
      url: `/trips/${anasTrip.id}`,
      headers: asBruno,
    });
    const missing = await app.inject({
      method: 'GET',
      url: '/trips/trip_does_not_exist',
      headers: asBruno,
    });

    expect(stolen.statusCode).toBe(404);
    // Identical body: the response must not reveal that the id exists.
    expect(stolen.json()).toEqual(missing.json());
  });

  it("refuses to patch or delete another user's trip", async () => {
    const app = appWithTrips();
    const anasTrip = await createTrip(app, asAna, { title: 'Litoral Norte' });

    const patched = await app.inject({
      method: 'PATCH',
      url: `/trips/${anasTrip.id}`,
      headers: asBruno,
      payload: { title: 'Roubada' },
    });
    expect(patched.statusCode).toBe(404);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/trips/${anasTrip.id}`,
      headers: asBruno,
    });
    expect(deleted.statusCode).toBe(404);

    // ...and the trip is untouched.
    const check = await app.inject({
      method: 'GET',
      url: `/trips/${anasTrip.id}`,
      headers: asAna,
    });
    expect(check.statusCode).toBe(200);
    expect(check.json().title).toBe('Litoral Norte');
  });

  it("refuses to add a day or an item to another user's trip", async () => {
    const app = appWithTrips();
    const anasTrip = await createTrip(app, asAna);
    const anasDay = await app
      .inject({ method: 'POST', url: `/trips/${anasTrip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());

    const day = await app.inject({
      method: 'POST',
      url: `/trips/${anasTrip.id}/days`,
      headers: asBruno,
      payload: {},
    });
    expect(day.statusCode).toBe(404);

    const item = await app.inject({
      method: 'POST',
      url: `/trips/${anasTrip.id}/days/${anasDay.id}/items`,
      headers: asBruno,
      payload: { moduleId: 'rota-custos', kind: 'route', title: 'X', payload: {} },
    });
    expect(item.statusCode).toBe(404);

    const del = await app.inject({
      method: 'DELETE',
      url: `/trips/${anasTrip.id}/days/${anasDay.id}/items/item_0001`,
      headers: asBruno,
    });
    expect(del.statusCode).toBe(404);
  });

  it('refuses a day that belongs to a different trip of the same user', async () => {
    const app = appWithTrips();
    const first = await createTrip(app, asAna, { title: 'Primeira' });
    const second = await createTrip(app, asAna, { title: 'Segunda' });

    const dayOfFirst = await app
      .inject({ method: 'POST', url: `/trips/${first.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());

    // The day exists and the caller owns both trips — but the day is not part
    // of `second`, so addressing it there must not work.
    const res = await app.inject({
      method: 'POST',
      url: `/trips/${second.id}/days/${dayOfFirst.id}/items`,
      headers: asAna,
      payload: { moduleId: 'rota-custos', kind: 'route', title: 'X', payload: {} },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /trips/:id (AC-8)', () => {
  it('updates only the fields given', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna, {
      title: 'Litoral Norte',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}`,
      headers: asAna,
      payload: { title: 'Litoral Norte (revisado)' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: trip.id,
      title: 'Litoral Norte (revisado)',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });
  });

  it('clears a date when sent explicit null', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna, { title: 'X', startDate: '2026-10-01' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}`,
      headers: asAna,
      payload: { startDate: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().startDate).toBeNull();
  });

  it('rejects a patch that would put the end before the start', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna, {
      title: 'X',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });

    // Valid on its own; invalid against the endDate already stored.
    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}`,
      headers: asAna,
      payload: { startDate: '2026-10-09' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('endDate');
  });

  it('accepts an empty patch as a no-op', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna, { title: 'Litoral Norte' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}`,
      headers: asAna,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Litoral Norte');
  });

  it('404s on a trip that does not exist', async () => {
    const res = await appWithTrips().inject({
      method: 'PATCH',
      url: '/trips/nope',
      headers: asAna,
      payload: { title: 'X' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /trips/:id (AC-9)', () => {
  it('deletes the trip and its days and items', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);
    const day = await app
      .inject({ method: 'POST', url: `/trips/${trip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());
    await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: { moduleId: 'rota-custos', kind: 'route', title: 'X', payload: {} },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/trips/${trip.id}`,
      headers: asAna,
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const after = await app.inject({ method: 'GET', url: `/trips/${trip.id}`, headers: asAna });
    expect(after.statusCode).toBe(404);

    const list = await app.inject({ method: 'GET', url: '/trips', headers: asAna });
    expect(list.json().trips).toEqual([]);
  });

  it('404s on a second delete', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    await app.inject({ method: 'DELETE', url: `/trips/${trip.id}`, headers: asAna });
    const again = await app.inject({ method: 'DELETE', url: `/trips/${trip.id}`, headers: asAna });

    expect(again.statusCode).toBe(404);
  });
});

describe('POST /trips/:id/days (AC-10)', () => {
  it('appends when order is omitted', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    const orders: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/trips/${trip.id}/days`,
        headers: asAna,
        payload: {},
      });
      orders.push(res.json().order);
    }

    expect(orders).toEqual([0, 1, 2]);
  });

  it('honours an explicit order', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days`,
      headers: asAna,
      payload: { order: 7 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().order).toBe(7);
  });

  it('accepts a day with no date as a deliberately unscheduled day', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days`,
      headers: asAna,
      payload: { date: null },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().date).toBeNull();
  });

  it('accepts a date outside the trip range (D-503, deliberate)', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna, {
      title: 'X',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days`,
      headers: asAna,
      payload: { date: '2026-12-25' },
    });

    expect(res.statusCode).toBe(201);
  });

  it.each([
    ['a malformed date', { date: '2026-2-1' }, 'date'],
    ['a negative order', { order: -1 }, 'order'],
    ['a fractional order', { order: 1.5 }, 'order'],
    ['a non-numeric order', { order: 'first' }, 'order'],
  ])('rejects %s with a 400 naming the field', async (_label, payload, field) => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days`,
      headers: asAna,
      payload,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(field);
  });
});

describe('POST /trips/:id/days/:dayId/items (AC-11)', () => {
  async function tripWithDay(app: App) {
    const trip = await createTrip(app, asAna);
    const day = await app
      .inject({ method: 'POST', url: `/trips/${trip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());
    return { trip, day };
  }

  const validItem = {
    moduleId: 'rota-custos',
    kind: 'route',
    title: 'São Paulo → Rio de Janeiro',
    payload: ROUTE_PAYLOAD,
  };

  it('appends items within a day', async () => {
    const app = appWithTrips();
    const { trip, day } = await tripWithDay(app);

    const orders: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/trips/${trip.id}/days/${day.id}/items`,
        headers: asAna,
        payload: validItem,
      });
      orders.push(res.json().order);
    }

    expect(orders).toEqual([0, 1, 2]);
  });

  it('defaults costEstimate to null when omitted', async () => {
    const app = appWithTrips();
    const { trip, day } = await tripWithDay(app);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: validItem,
    });

    expect(res.json().costEstimate).toBeNull();
  });

  it('accepts a negative costEstimate — a refund is a real line item (D-504)', async () => {
    const app = appWithTrips();
    const { trip, day } = await tripWithDay(app);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: { ...validItem, costEstimate: -50 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().costEstimate).toBe(-50);
  });

  it('accepts an unknown moduleId — no allow-list, so F2b-d need no API release (D-502)', async () => {
    const app = appWithTrips();
    const { trip, day } = await tripWithDay(app);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload: { ...validItem, moduleId: 'modulo-que-ainda-nao-existe' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().moduleId).toBe('modulo-que-ainda-nao-existe');
  });

  it.each([
    ['a missing moduleId', { ...validItem, moduleId: undefined }, 'moduleId'],
    ['a blank moduleId', { ...validItem, moduleId: '  ' }, 'moduleId'],
    ['a blank kind', { ...validItem, kind: '' }, 'kind'],
    ['a blank title', { ...validItem, title: '  ' }, 'title'],
    ['a missing payload', { ...validItem, payload: undefined }, 'payload'],
    ['a null payload', { ...validItem, payload: null }, 'payload'],
    ['a non-numeric costEstimate', { ...validItem, costEstimate: 'caro' }, 'costEstimate'],
  ])('rejects %s with a 400 naming the field', async (_label, payload, field) => {
    const app = appWithTrips();
    const { trip, day } = await tripWithDay(app);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/${day.id}/items`,
      headers: asAna,
      payload,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(field);
  });

  it('404s when the day does not exist', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);

    const res = await app.inject({
      method: 'POST',
      url: `/trips/${trip.id}/days/day_nope/items`,
      headers: asAna,
      payload: validItem,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /trips/:id/days/:dayId/items/:itemId (AC-12)', () => {
  it('deletes the item and leaves the day', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);
    const day = await app
      .inject({ method: 'POST', url: `/trips/${trip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());
    const item = await app
      .inject({
        method: 'POST',
        url: `/trips/${trip.id}/days/${day.id}/items`,
        headers: asAna,
        payload: { moduleId: 'rota-custos', kind: 'route', title: 'X', payload: {} },
      })
      .then((r) => r.json());

    const res = await app.inject({
      method: 'DELETE',
      url: `/trips/${trip.id}/days/${day.id}/items/${item.id}`,
      headers: asAna,
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const detail = await app
      .inject({ method: 'GET', url: `/trips/${trip.id}`, headers: asAna })
      .then((r) => r.json());
    expect(detail.days).toHaveLength(1);
    expect(detail.days[0].items).toEqual([]);
  });

  it('404s on an item that does not exist', async () => {
    const app = appWithTrips();
    const trip = await createTrip(app, asAna);
    const day = await app
      .inject({ method: 'POST', url: `/trips/${trip.id}/days`, headers: asAna, payload: {} })
      .then((r) => r.json());

    const res = await app.inject({
      method: 'DELETE',
      url: `/trips/${trip.id}/days/${day.id}/items/item_nope`,
      headers: asAna,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('error bodies (AC-16)', () => {
  it('always uses { error: string }', async () => {
    const app = appWithTrips();

    const responses = [
      await app.inject({ method: 'GET', url: '/trips' }),
      await app.inject({ method: 'GET', url: '/trips/nope', headers: asAna }),
      await app.inject({ method: 'POST', url: '/trips', headers: asAna, payload: { title: '' } }),
    ];

    for (const res of responses) {
      expect.soft(res.json()).toEqual({ error: expect.any(String) });
    }
  });

  it('never echoes the bearer token back in an error', async () => {
    const res = await appWithTrips().inject({
      method: 'GET',
      url: '/trips',
      headers: { authorization: 'Bearer super-secret-token-value' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).not.toContain('super-secret-token-value');
  });
});

describe('an app built without the trips ports (D-513)', () => {
  it('serves F1 and exposes no /trips surface', async () => {
    const app = buildApp({ routing: fakeRoutingProvider(), geocode: fakeGeocodeProvider() });

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    const trips = await app.inject({ method: 'GET', url: '/trips', headers: asAna });
    expect(trips.statusCode).toBe(404);
  });

  it('refuses to build with only one of the two ports', () => {
    expect(() =>
      buildApp({
        routing: fakeRoutingProvider(),
        geocode: fakeGeocodeProvider(),
        trips: inMemoryTripStore(),
      }),
    ).toThrow(/auth/i);
  });
});
