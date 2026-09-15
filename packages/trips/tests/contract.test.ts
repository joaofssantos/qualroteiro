/**
 * Compile-time guard on the frozen contract.
 *
 * The interfaces below are a hand copy of `F2-COORDINATION.md` §3. They exist
 * so that renaming a field in `src/types.ts`, changing its type, or making one
 * optional fails `pnpm --filter @qualroteiro/trips typecheck` — rather than
 * reaching `apps/web`, which is being written against that document right now,
 * as a runtime surprise.
 *
 * If a change here is genuinely wanted: update `F2-COORDINATION.md` and its
 * progress log first, then this file, then `src/types.ts`. In that order.
 */
import { describe, expect, it } from 'vitest';

import type { Trip, TripDay, TripItem } from '../src/types.js';

// ── F2-COORDINATION.md §3, transcribed ──────────────────────────────────────

interface ContractTrip {
  id: string;
  userId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContractTripDay {
  id: string;
  tripId: string;
  date: string | null;
  order: number;
}

interface ContractTripItem {
  id: string;
  tripDayId: string;
  order: number;
  moduleId: string;
  kind: string;
  title: string;
  payload: unknown;
  costEstimate: number | null;
}

// ── Assertions ──────────────────────────────────────────────────────────────

/**
 * Mutual assignability. One direction alone is too weak: `A extends B` still
 * holds when `A` adds a required field, and `B extends A` still holds when `A`
 * drops one. Requiring both pins the field set exactly.
 *
 * `readonly` is intentionally invisible to this check — it does not affect
 * assignability in TypeScript, and it does not affect the JSON on the wire
 * either, which is what the contract is actually about.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Assert<T extends true> = T;

type _TripMatchesContract = Assert<Exact<Trip, ContractTrip>>;
type _TripDayMatchesContract = Assert<Exact<TripDay, ContractTripDay>>;
type _TripItemMatchesContract = Assert<Exact<TripItem, ContractTripItem>>;

describe('frozen type contract (F2-COORDINATION.md §3)', () => {
  it('holds at compile time — this body runs only to give vitest a case', () => {
    // The real assertions are the `Assert<Exact<…>>` aliases above: they are
    // checked by `tsc -p tsconfig.test.json`, not by this runtime expectation.
    // A field rename fails typecheck; vitest would never notice, because
    // interfaces are erased before this line ever executes.
    const trip: ContractTrip = {
      id: 'trip_1',
      userId: 'user_1',
      title: 'Litoral Norte',
      startDate: null,
      endDate: null,
      createdAt: '2026-09-15T12:00:00.000Z',
      updatedAt: '2026-09-15T12:00:00.000Z',
    } satisfies Trip;

    expect(Object.keys(trip).sort()).toEqual([
      'createdAt',
      'endDate',
      'id',
      'startDate',
      'title',
      'updatedAt',
      'userId',
    ]);
  });
});
