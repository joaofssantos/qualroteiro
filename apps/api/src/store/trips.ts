/**
 * The persistence port for the trip domain.
 *
 * `src/store/prisma-trips.ts` is the production implementation;
 * `tests/helpers/trip-fakes.ts` is an in-memory one. Handlers depend only on
 * this interface (specs/005-f2a-trips/plan.md D-505).
 *
 * ## Every method takes `userId` first, and that is the whole security model
 *
 * There is no `getTrip(id)` to accidentally call. A caller cannot express
 * "load this trip" without also saying whose it must be, so the ownership
 * filter cannot be omitted in one handler out of eight — which is the failure
 * mode a read-then-compare design invites (plan.md D-508). A trip that exists
 * but belongs to someone else is reported exactly as one that does not exist:
 * `null` from a read, `false` from a write.
 */

import type { Trip, TripDay, TripItem } from '@qualroteiro/trips';

/** A `Trip` plus the two counts `GET /trips` shows (`F2-COORDINATION.md` §3). */
export interface TripSummary extends Trip {
  readonly dayCount: number;
  readonly itemCount: number;
}

/** A day with its items — the nesting `GET /trips/:id` returns. */
export interface TripDayWithItems extends TripDay {
  readonly items: readonly TripItem[];
}

/** `GET /trips/:id`'s whole response body. */
export interface TripDetail extends Trip {
  readonly days: readonly TripDayWithItems[];
}

export interface CreateTripInput {
  readonly userId: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

/**
 * A partial update. An absent key means "leave it alone"; an explicit `null`
 * on a date means "clear it". That distinction is why these are optional
 * rather than nullable-and-required.
 */
export interface UpdateTripInput {
  readonly title?: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

export interface CreateTripDayInput {
  readonly date: string | null;
  /** Omitted means append — the store assigns `max(order) + 1` (plan.md D-509). */
  readonly order?: number;
}

/**
 * `order` is absent on purpose: `F2-COORDINATION.md` §3's item body has no such
 * field, so an item always appends within its day.
 */
export interface CreateTripItemInput {
  readonly moduleId: string;
  readonly kind: string;
  readonly title: string;
  readonly payload: unknown;
  readonly costEstimate: number | null;
}

export interface TripStore {
  createTrip(input: CreateTripInput): Promise<Trip>;

  /** The caller's trips, newest first, each with its day and item counts. */
  listTrips(userId: string): Promise<readonly TripSummary[]>;

  /** The trip alone, without days — what `PATCH` needs to merge against. */
  findTrip(userId: string, tripId: string): Promise<Trip | null>;

  /** The trip with days and items nested, days and items each in `order`. */
  getTripDetail(userId: string, tripId: string): Promise<TripDetail | null>;

  updateTrip(userId: string, tripId: string, patch: UpdateTripInput): Promise<Trip | null>;

  /** Removes the trip and, by cascade, its days and items. */
  deleteTrip(userId: string, tripId: string): Promise<boolean>;

  createDay(
    userId: string,
    tripId: string,
    input: CreateTripDayInput,
  ): Promise<TripDay | null>;

  /**
   * `null` when the trip is not the caller's **or** the day is not part of
   * that trip — a day id from another trip must not be addressable here.
   */
  createItem(
    userId: string,
    tripId: string,
    dayId: string,
    input: CreateTripItemInput,
  ): Promise<TripItem | null>;

  deleteItem(userId: string, tripId: string, dayId: string, itemId: string): Promise<boolean>;
}
