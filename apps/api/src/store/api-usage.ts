/**
 * `ApiUsageStore` — the port over the persisted `ApiUsageCounter` table that
 * G1's circuit breaker reads and increments.
 *
 * Same reasoning as `store/trips.ts` (D-505 in `specs/005-f2a-trips/plan.md`):
 * a port, not a concrete Prisma type, is what lets the breaker's refuse-before
 * -calling logic be proven with an in-memory fake and no database — the most
 * important property this whole feature has to demonstrate.
 */

export interface UsageCounterSnapshot {
  readonly sku: string;
  readonly yearMonth: string;
  readonly count: number;
}

export interface ApiUsageStore {
  /** The current count for `sku` in `yearMonth`, or `0` if no row exists yet. */
  getCount(sku: string, yearMonth: string): Promise<number>;

  /**
   * Atomically create-or-increment the `sku` + `yearMonth` counter and return
   * the row after the increment.
   *
   * Call this ONLY after the external call it is counting actually completed
   * — a call the breaker refused, or one that failed before the provider's
   * request finished, must NOT increment. See `ApiUsageCounter`'s doc-comment
   * in `prisma/schema.prisma`.
   */
  increment(sku: string, yearMonth: string): Promise<UsageCounterSnapshot>;

  /** Every counter currently stored, for `GET /admin/places-usage`. */
  listAll(): Promise<readonly UsageCounterSnapshot[]>;
}

/**
 * The calendar month `now` falls in, in UTC, as `YYYY-MM`.
 *
 * UTC rather than server-local time: a counter keyed by local time would
 * roll over at a different real-world instant depending on where the process
 * happens to run, which is exactly the kind of drift a monthly cost cap must
 * not have.
 */
export function currentYearMonth(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
