/**
 * Test doubles for the two F2a ports: {@link AuthVerifier} and
 * {@link TripStore}.
 *
 * Same purpose as `fakes.ts` does for WAVE 1's providers — they are handed to
 * `buildApp` and the production handlers run against them unmodified, so the
 * whole `/trips*` surface is exercised with no Clerk network call and no
 * database. That is what makes the acceptance flow testable while no Postgres
 * is reachable (specs/005-f2a-trips/plan.md D-505, D-506).
 *
 * The in-memory store is a real implementation of the port's semantics —
 * ownership scoping, append ordering, cascade — not a stub returning fixtures.
 * A store that faked those would prove nothing about the handlers.
 */

import type { AuthVerifier } from '../../src/auth/verifier.js';
import { UnauthorizedError } from '../../src/errors.js';
import type {
  CreateTripDayInput,
  CreateTripInput,
  CreateTripItemInput,
  TripDetail,
  TripStore,
  TripSummary,
  UpdateTripInput,
} from '../../src/store/trips.js';
import type { Trip, TripDay, TripItem } from '@qualroteiro/trips';

/**
 * An {@link AuthVerifier} backed by a token → userId table.
 *
 * Any token not in the table is rejected exactly as Clerk would reject an
 * expired or forged one, so the `401` tests exercise the real handler path.
 */
export function fakeAuthVerifier(tokens: Readonly<Record<string, string>>): AuthVerifier {
  return {
    async verifyBearerToken(token: string): Promise<{ userId: string }> {
      const userId = tokens[token];
      if (userId === undefined) {
        throw new UnauthorizedError('invalid or expired session token');
      }
      return { userId };
    },
  };
}

interface StoredTrip {
  id: string;
  userId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredDay {
  id: string;
  tripId: string;
  date: string | null;
  order: number;
}

interface StoredItem {
  id: string;
  tripDayId: string;
  order: number;
  moduleId: string;
  kind: string;
  title: string;
  payload: unknown;
  costEstimate: number | null;
}

/** A `TripStore` holding everything in three arrays. */
export function inMemoryTripStore(): TripStore {
  const trips: StoredTrip[] = [];
  const days: StoredDay[] = [];
  const items: StoredItem[] = [];

  let seq = 0;
  const nextId = (prefix: string): string => `${prefix}_${String(++seq).padStart(4, '0')}`;

  // A fixed clock: the tests assert on shape, and a moving `now` makes
  // createdAt/updatedAt comparisons flaky on a fast machine.
  let tick = 0;
  const now = (): string => new Date(Date.UTC(2026, 8, 15, 12, 0, tick++)).toISOString();

  const toTrip = (t: StoredTrip): Trip => ({ ...t });
  const toDay = (d: StoredDay): TripDay => ({ ...d });
  const toItem = (i: StoredItem): TripItem => ({ ...i });

  /** The ownership scope every read goes through (plan.md D-508). */
  const ownedTrip = (userId: string, tripId: string): StoredTrip | undefined =>
    trips.find((t) => t.id === tripId && t.userId === userId);

  const daysOf = (tripId: string): StoredDay[] =>
    days.filter((d) => d.tripId === tripId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const itemsOf = (dayId: string): StoredItem[] =>
    items
      .filter((i) => i.tripDayId === dayId)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const nextOrder = (existing: readonly { order: number }[]): number =>
    existing.length === 0 ? 0 : Math.max(...existing.map((e) => e.order)) + 1;

  return {
    async createTrip(input: CreateTripInput): Promise<Trip> {
      const stamp = now();
      const trip: StoredTrip = {
        id: nextId('trip'),
        userId: input.userId,
        title: input.title,
        startDate: input.startDate,
        endDate: input.endDate,
        createdAt: stamp,
        updatedAt: stamp,
      };
      trips.push(trip);
      return toTrip(trip);
    },

    async listTrips(userId: string): Promise<readonly TripSummary[]> {
      return trips
        .filter((t) => t.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((t) => {
          const tripDays = daysOf(t.id);
          return {
            ...toTrip(t),
            dayCount: tripDays.length,
            itemCount: tripDays.reduce((sum, d) => sum + itemsOf(d.id).length, 0),
          };
        });
    },

    async findTrip(userId: string, tripId: string): Promise<Trip | null> {
      const trip = ownedTrip(userId, tripId);
      return trip === undefined ? null : toTrip(trip);
    },

    async getTripDetail(userId: string, tripId: string): Promise<TripDetail | null> {
      const trip = ownedTrip(userId, tripId);
      if (trip === undefined) return null;
      return {
        ...toTrip(trip),
        days: daysOf(trip.id).map((d) => ({
          ...toDay(d),
          items: itemsOf(d.id).map(toItem),
        })),
      };
    },

    async updateTrip(userId: string, tripId: string, patch: UpdateTripInput): Promise<Trip | null> {
      const trip = ownedTrip(userId, tripId);
      if (trip === undefined) return null;
      if (patch.title !== undefined) trip.title = patch.title;
      if (patch.startDate !== undefined) trip.startDate = patch.startDate;
      if (patch.endDate !== undefined) trip.endDate = patch.endDate;
      trip.updatedAt = now();
      return toTrip(trip);
    },

    async deleteTrip(userId: string, tripId: string): Promise<boolean> {
      const index = trips.findIndex((t) => t.id === tripId && t.userId === userId);
      if (index === -1) return false;

      // The cascade the schema declares, done by hand here.
      for (const day of days.filter((d) => d.tripId === tripId)) {
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i]?.tripDayId === day.id) items.splice(i, 1);
        }
      }
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i]?.tripId === tripId) days.splice(i, 1);
      }
      trips.splice(index, 1);
      return true;
    },

    async createDay(
      userId: string,
      tripId: string,
      input: CreateTripDayInput,
    ): Promise<TripDay | null> {
      const trip = ownedTrip(userId, tripId);
      if (trip === undefined) return null;

      const day: StoredDay = {
        id: nextId('day'),
        tripId,
        date: input.date,
        order: input.order ?? nextOrder(daysOf(tripId)),
      };
      days.push(day);
      return toDay(day);
    },

    async createItem(
      userId: string,
      tripId: string,
      dayId: string,
      input: CreateTripItemInput,
    ): Promise<TripItem | null> {
      const trip = ownedTrip(userId, tripId);
      if (trip === undefined) return null;

      const day = days.find((d) => d.id === dayId && d.tripId === tripId);
      if (day === undefined) return null;

      const item: StoredItem = {
        id: nextId('item'),
        tripDayId: day.id,
        order: nextOrder(itemsOf(day.id)),
        moduleId: input.moduleId,
        kind: input.kind,
        title: input.title,
        payload: input.payload,
        costEstimate: input.costEstimate,
      };
      items.push(item);
      return toItem(item);
    },

    async deleteItem(
      userId: string,
      tripId: string,
      dayId: string,
      itemId: string,
    ): Promise<boolean> {
      const trip = ownedTrip(userId, tripId);
      if (trip === undefined) return false;

      const day = days.find((d) => d.id === dayId && d.tripId === tripId);
      if (day === undefined) return false;

      const index = items.findIndex((i) => i.id === itemId && i.tripDayId === day.id);
      if (index === -1) return false;

      items.splice(index, 1);
      return true;
    },
  };
}
