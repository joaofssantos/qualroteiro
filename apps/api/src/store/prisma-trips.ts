/**
 * The Prisma implementation of {@link TripStore}.
 *
 * Constructed only by `src/server.ts`. Every query carries the `userId` in its
 * `where` clause rather than filtering in JavaScript afterwards, so the
 * ownership rule is enforced by the database and a non-owner's row is never
 * loaded into this process at all (plan.md D-508).
 *
 * ## Verification status
 *
 * This module is **typecheck-verified only**. The Docker daemon was
 * unreachable while this unit was built, so no migration was ever applied and
 * no query here has executed against Postgres. See
 * specs/005-f2a-trips/tasks.md §"Limits" — this is the first thing to exercise
 * once a database is available.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import type { Trip, TripDay, TripItem } from '@qualroteiro/trips';

import type {
  CreateTripDayInput,
  CreateTripInput,
  CreateTripItemInput,
  TripDetail,
  TripStore,
  TripSummary,
  UpdateTripInput,
} from './trips.js';

/** The row shape Prisma returns for a `Trip`, before timestamps are stringified. */
interface TripRow {
  id: string;
  userId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DayRow {
  id: string;
  tripId: string;
  date: string | null;
  order: number;
}

interface ItemRow {
  id: string;
  tripDayId: string;
  order: number;
  moduleId: string;
  kind: string;
  title: string;
  payload: Prisma.JsonValue;
  costEstimate: number | null;
}

/**
 * `createdAt`/`updatedAt` are the only values needing conversion: the contract
 * types them as ISO datetime **strings**, and Prisma hands back `Date`s. The
 * trip's own `startDate`/`endDate` need none — they are stored as the exact
 * `YYYY-MM-DD` text the contract specifies, which is the whole reason they are
 * text columns (plan.md §Data model).
 */
const toTrip = (row: TripRow): Trip => ({
  id: row.id,
  userId: row.userId,
  title: row.title,
  startDate: row.startDate,
  endDate: row.endDate,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toDay = (row: DayRow): TripDay => ({
  id: row.id,
  tripId: row.tripId,
  date: row.date,
  order: row.order,
});

const toItem = (row: ItemRow): TripItem => ({
  id: row.id,
  tripDayId: row.tripDayId,
  order: row.order,
  moduleId: row.moduleId,
  kind: row.kind,
  title: row.title,
  payload: row.payload,
  costEstimate: row.costEstimate,
});

/**
 * Ties are broken by `id` so a page of days or items is stably ordered.
 * `order` is not unique by design (plan.md D-509) — duplicates are what an
 * "insert between" gesture produces — so ordering by it alone would let two
 * days swap places between two reads.
 */
const BY_ORDER = [{ order: 'asc' as const }, { id: 'asc' as const }];

export function createPrismaTripStore(prisma: PrismaClient): TripStore {
  /** Is this trip the caller's? The gate every nested write goes through. */
  const ownsTrip = async (userId: string, tripId: string): Promise<boolean> =>
    (await prisma.trip.count({ where: { id: tripId, userId } })) > 0;

  return {
    async createTrip(input: CreateTripInput): Promise<Trip> {
      const row = await prisma.trip.create({
        data: {
          userId: input.userId,
          title: input.title,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });
      return toTrip(row);
    },

    async listTrips(userId: string): Promise<readonly TripSummary[]> {
      const rows = await prisma.trip.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          days: { select: { _count: { select: { items: true } } } },
        },
      });

      return rows.map((row) => ({
        ...toTrip(row),
        dayCount: row.days.length,
        itemCount: row.days.reduce((sum, day) => sum + day._count.items, 0),
      }));
    },

    async findTrip(userId: string, tripId: string): Promise<Trip | null> {
      const row = await prisma.trip.findFirst({ where: { id: tripId, userId } });
      return row === null ? null : toTrip(row);
    },

    async getTripDetail(userId: string, tripId: string): Promise<TripDetail | null> {
      const row = await prisma.trip.findFirst({
        where: { id: tripId, userId },
        include: {
          days: {
            orderBy: BY_ORDER,
            include: { items: { orderBy: BY_ORDER } },
          },
        },
      });

      if (row === null) return null;

      return {
        ...toTrip(row),
        days: row.days.map((day) => ({
          ...toDay(day),
          items: day.items.map(toItem),
        })),
      };
    },

    async updateTrip(
      userId: string,
      tripId: string,
      patch: UpdateTripInput,
    ): Promise<Trip | null> {
      // `updateMany` rather than `update`: it takes a full `where`, so the
      // ownership filter is part of the write itself. `update` accepts only a
      // unique field, which would force a read-then-write and a window where
      // the check and the write disagree.
      const { count } = await prisma.trip.updateMany({
        where: { id: tripId, userId },
        data: patch,
      });

      if (count === 0) return null;

      const row = await prisma.trip.findFirst({ where: { id: tripId, userId } });
      return row === null ? null : toTrip(row);
    },

    async deleteTrip(userId: string, tripId: string): Promise<boolean> {
      // Days and items go with it via the schema's `onDelete: Cascade`.
      const { count } = await prisma.trip.deleteMany({ where: { id: tripId, userId } });
      return count > 0;
    },

    async createDay(
      userId: string,
      tripId: string,
      input: CreateTripDayInput,
    ): Promise<TripDay | null> {
      if (!(await ownsTrip(userId, tripId))) return null;

      let order = input.order;
      if (order === undefined) {
        const { _max } = await prisma.tripDay.aggregate({
          where: { tripId },
          _max: { order: true },
        });
        order = _max.order === null ? 0 : _max.order + 1;
      }

      const row = await prisma.tripDay.create({
        data: { tripId, date: input.date, order },
      });
      return toDay(row);
    },

    async createItem(
      userId: string,
      tripId: string,
      dayId: string,
      input: CreateTripItemInput,
    ): Promise<TripItem | null> {
      // One query covers both questions: the day must exist, belong to this
      // trip, and that trip must belong to the caller. A day id borrowed from
      // another of the caller's own trips fails here too.
      const day = await prisma.tripDay.findFirst({
        where: { id: dayId, tripId, trip: { userId } },
        select: { id: true },
      });
      if (day === null) return null;

      const { _max } = await prisma.tripItem.aggregate({
        where: { tripDayId: day.id },
        _max: { order: true },
      });

      const row = await prisma.tripItem.create({
        data: {
          tripDayId: day.id,
          order: _max.order === null ? 0 : _max.order + 1,
          moduleId: input.moduleId,
          kind: input.kind,
          title: input.title,
          payload: input.payload as Prisma.InputJsonValue,
          costEstimate: input.costEstimate,
        },
      });
      return toItem(row);
    },

    async deleteItem(
      userId: string,
      tripId: string,
      dayId: string,
      itemId: string,
    ): Promise<boolean> {
      const { count } = await prisma.tripItem.deleteMany({
        where: {
          id: itemId,
          tripDayId: dayId,
          day: { tripId, trip: { userId } },
        },
      });
      return count > 0;
    },
  };
}
