import { describe, expect, it } from 'vitest';

import type { Trip, TripDay, TripItem } from '../src/types.js';
import {
  isIsoDate,
  validateTrip,
  validateTripDates,
  validateTripDay,
  validateTripItem,
  validateTripTitle,
} from '../src/validate.js';

/**
 * Every validator is typed, but its real caller is an HTTP boundary where
 * `JSON.parse` hands over whatever the client sent. `asAnything` is how the
 * invalid-case tests reach past the type annotation to exercise the runtime
 * guards — see `specs/005-trips-domain/plan.md`.
 */
const asAnything = <T>(value: unknown): T => value as T;

describe('isIsoDate', () => {
  it('accepts a zero-padded calendar date', () => {
    expect(isIsoDate('2026-10-01')).toBe(true);
  });

  it('accepts a leap day in a leap year', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects a well-formed string that is not a real date', () => {
    // The regex alone would accept all three; the calendar round-trip is what
    // rejects them.
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-02-29')).toBe(false); // 2026 is not a leap year
  });

  it('rejects dates that are not zero-padded', () => {
    // Lexicographic comparison in validateTripDates is only sound for padded
    // dates, so this has to be a hard reject rather than a tolerated variant.
    expect(isIsoDate('2026-2-1')).toBe(false);
  });

  it('rejects other formats and non-strings', () => {
    expect(isIsoDate('01/10/2026')).toBe(false);
    expect(isIsoDate('2026-10-01T00:00:00Z')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(20261001)).toBe(false);
  });
});

describe('validateTripTitle', () => {
  it('accepts a non-empty title', () => {
    expect(validateTripTitle('Litoral Norte')).toEqual({ ok: true });
  });

  it('accepts a title that only needs trimming', () => {
    expect(validateTripTitle('  Serra Gaúcha  ')).toEqual({ ok: true });
  });

  it('rejects an empty title', () => {
    const result = validateTripTitle('');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors).toEqual(['title: must not be empty']);
  });

  it('rejects a whitespace-only title', () => {
    const result = validateTripTitle('   \t\n ');
    expect(result.ok).toBe(false);
  });

  it('rejects a non-string title', () => {
    expect(validateTripTitle(asAnything<string>(42)).ok).toBe(false);
    expect(validateTripTitle(asAnything<string>(null)).ok).toBe(false);
    expect(validateTripTitle(asAnything<string>(undefined)).ok).toBe(false);
  });
});

describe('validateTripDates', () => {
  it('accepts both dates absent', () => {
    expect(validateTripDates(null, null)).toEqual({ ok: true });
    expect(validateTripDates(undefined, undefined)).toEqual({ ok: true });
    expect(validateTripDates()).toEqual({ ok: true });
  });

  it('accepts only one date present', () => {
    expect(validateTripDates('2026-10-01', null)).toEqual({ ok: true });
    expect(validateTripDates(null, '2026-10-05')).toEqual({ ok: true });
  });

  it('accepts a start before the end', () => {
    expect(validateTripDates('2026-10-01', '2026-10-05')).toEqual({ ok: true });
  });

  it('accepts equal dates — a one-day trip is legitimate', () => {
    expect(validateTripDates('2026-10-01', '2026-10-01')).toEqual({ ok: true });
  });

  it('accepts a range spanning a year boundary', () => {
    // Guards the lexicographic comparison against the obvious off-by-a-year.
    expect(validateTripDates('2026-12-28', '2027-01-03')).toEqual({ ok: true });
  });

  it('rejects an end before the start', () => {
    const result = validateTripDates('2026-10-05', '2026-10-01');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors).toHaveLength(1);
    expect(result.ok === false && result.errors[0]).toContain('endDate');
  });

  it('rejects a malformed date on either side', () => {
    expect(validateTripDates('01/10/2026', '2026-10-05').ok).toBe(false);
    expect(validateTripDates('2026-10-01', '2026-02-30').ok).toBe(false);
  });

  it('reports both dates when both are malformed', () => {
    const result = validateTripDates('nope', 'also-nope');
    expect(result.ok === false && result.errors).toHaveLength(2);
  });

  it('does not also complain about ordering when a date is malformed', () => {
    // A comparison against an unparseable date is meaningless; reporting it
    // as an ordering problem would send the caller chasing the wrong field.
    const result = validateTripDates('not-a-date', '2026-10-01');
    expect(result.ok === false && result.errors).toHaveLength(1);
    expect(result.ok === false && result.errors[0]).toContain('startDate');
  });
});

describe('validateTrip', () => {
  const validTrip: Trip = {
    id: 'trip_1',
    userId: 'user_2abcXYZ',
    title: 'Litoral Norte',
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    createdAt: '2026-09-15T12:00:00.000Z',
    updatedAt: '2026-09-15T12:00:00.000Z',
  };

  it('accepts a full valid trip', () => {
    expect(validateTrip(validTrip)).toEqual({ ok: true });
  });

  it('accepts a create-time draft with no id and no dates', () => {
    // POST /trips sends exactly this. A validator typed as (trip: Trip) would
    // be unusable here.
    expect(validateTrip({ title: 'Sem datas ainda' })).toEqual({ ok: true });
  });

  it('accepts an undated trip', () => {
    expect(validateTrip({ ...validTrip, startDate: null, endDate: null })).toEqual({ ok: true });
  });

  it('rejects a trip with a blank title', () => {
    expect(validateTrip({ ...validTrip, title: '  ' }).ok).toBe(false);
  });

  it('rejects a trip whose end precedes its start', () => {
    expect(validateTrip({ ...validTrip, startDate: '2026-10-05', endDate: '2026-10-01' }).ok).toBe(
      false,
    );
  });

  it('reports every problem at once, not just the first', () => {
    // This is the test a throwing design could not satisfy, and the reason
    // the package returns a result instead of throwing RangeError the way
    // @qualroteiro/fuel does.
    const result = validateTrip({ title: '   ', startDate: '2026-10-05', endDate: '2026-10-01' });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors).toHaveLength(2);
    expect(result.ok === false && result.errors.join(' ')).toContain('title');
    expect(result.ok === false && result.errors.join(' ')).toContain('endDate');
  });

  it('ignores userId, createdAt and updatedAt', () => {
    // Clerk owns the user id format and the persistence layer owns the
    // timestamps; this package asserts nothing about either.
    //
    // Bound to a `Trip` rather than written inline because TypeScript's
    // excess-property check rejects an *explicitly written* key that TripInput
    // does not declare. Passing a whole entity — which is what apps/api does
    // with a loaded trip — is fine, and this const proves that assignability.
    const junkMetadata: Trip = { ...validTrip, userId: '', createdAt: 'whenever' };
    expect(validateTrip(junkMetadata)).toEqual({ ok: true });
  });
});

describe('validateTripDay', () => {
  const validDay: TripDay = {
    id: 'day_1',
    tripId: 'trip_1',
    date: '2026-10-01',
    order: 0,
  };

  it('accepts a valid day', () => {
    expect(validateTripDay(validDay)).toEqual({ ok: true });
  });

  it('accepts order 0 — ordering is 0-based', () => {
    expect(validateTripDay({ ...validDay, order: 0 })).toEqual({ ok: true });
  });

  it('accepts an unscheduled day', () => {
    expect(validateTripDay({ ...validDay, date: null })).toEqual({ ok: true });
  });

  it('rejects a negative order', () => {
    const result = validateTripDay({ ...validDay, order: -1 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors[0]).toContain('order');
  });

  it('rejects a fractional order', () => {
    expect(validateTripDay({ ...validDay, order: 1.5 }).ok).toBe(false);
  });

  it('rejects a non-finite or non-numeric order', () => {
    expect(validateTripDay({ ...validDay, order: Number.NaN }).ok).toBe(false);
    expect(validateTripDay({ ...validDay, order: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(validateTripDay(asAnything<TripDay>({ ...validDay, order: '0' })).ok).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(validateTripDay({ ...validDay, date: '2026-02-30' }).ok).toBe(false);
  });
});

describe('validateTripItem', () => {
  const validItem: TripItem = {
    id: 'item_1',
    tripDayId: 'day_1',
    order: 0,
    moduleId: 'rota-custos',
    kind: 'route',
    title: 'São Paulo → Rio de Janeiro',
    payload: { distanceKm: 430 },
    costEstimate: 312.45,
  };

  it('accepts a valid item', () => {
    expect(validateTripItem(validItem)).toEqual({ ok: true });
  });

  it('accepts a null costEstimate', () => {
    const uncosted: TripItem = { ...validItem, costEstimate: null };
    expect(validateTripItem(uncosted)).toEqual({ ok: true });
  });

  it('accepts a moduleId this package has never heard of', () => {
    // F2b-d add modules. An allow-list here would reject them on arrival.
    expect(validateTripItem({ ...validItem, moduleId: 'algo-que-nao-existe-ainda' })).toEqual({
      ok: true,
    });
  });

  it('rejects a negative order', () => {
    expect(validateTripItem({ ...validItem, order: -1 }).ok).toBe(false);
  });

  it('rejects a fractional order', () => {
    expect(validateTripItem({ ...validItem, order: 0.5 }).ok).toBe(false);
  });

  it('rejects a blank moduleId', () => {
    const result = validateTripItem({ ...validItem, moduleId: '   ' });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors[0]).toContain('moduleId');
  });

  it('rejects a blank kind and a blank title', () => {
    expect(validateTripItem({ ...validItem, kind: '' }).ok).toBe(false);
    expect(validateTripItem({ ...validItem, title: '' }).ok).toBe(false);
  });

  it('reports every problem at once', () => {
    const result = validateTripItem({ ...validItem, order: -1, moduleId: '', title: '' });
    expect(result.ok === false && result.errors).toHaveLength(3);
  });

  it('says nothing about payload', () => {
    // payload is `unknown` by design — only the owning module can read it.
    // TripItemInput does not even declare the field, so these have to be bound
    // as full items to get past the excess-property check.
    const noPayload: TripItem = { ...validItem, payload: undefined };
    const nullPayload: TripItem = { ...validItem, payload: null };
    expect(validateTripItem(noPayload)).toEqual({ ok: true });
    expect(validateTripItem(nullPayload)).toEqual({ ok: true });
  });
});
