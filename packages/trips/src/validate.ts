/**
 * Pure validation for the trip domain. No I/O, no persistence, no Clerk.
 *
 * ## Why these return instead of throwing
 *
 * `@qualroteiro/fuel` and `@qualroteiro/tolls` throw `RangeError` on bad
 * input. They are *computation* functions asserting a precondition they cannot
 * proceed without — there is no sensible litre count for a negative distance.
 *
 * A validator is the other thing: producing the verdict *is* the job, so an
 * invalid input is the normal path, not an exception. And throwing surfaces
 * only the first problem, while the consumer (`apps/api`, answering
 * `400 { "error": … }` for a submitted form) wants all of them at once.
 *
 * A caller who prefers the house style converts in one line:
 *
 * ```ts
 * const result = validateTrip(input);
 * if (!result.ok) throw new RangeError(result.errors.join('; '));
 * ```
 *
 * The reverse — recovering a list from a thrown error — is not possible, which
 * is what settles the direction.
 *
 * ## Why the parameters are type-checked at runtime
 *
 * These are typed, but their real caller is an HTTP boundary where
 * `JSON.parse` yields whatever the client sent. The annotations document the
 * intended call; the `typeof` guards are what make the functions safe for the
 * only caller that matters.
 */

/**
 * The verdict. A discriminated union so TypeScript narrows `errors`, and so an
 * `ok` result carries no empty array for callers to second-guess.
 */
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * The fields {@link validateTrip} reads.
 *
 * Dates are optional *and* nullable so that one function serves both callers:
 * `POST /trips` sends `{ title, startDate?, endDate? }` with no id yet, while a
 * loaded {@link import('./types.js').Trip} — whose dates are a required
 * `string | null` — is assignable here too.
 */
export interface TripInput {
  readonly title: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

/** The fields {@link validateTripDay} reads. */
export interface TripDayInput {
  readonly date?: string | null;
  readonly order: number;
}

/** The fields {@link validateTripItem} reads. `payload` is deliberately absent. */
export interface TripItemInput {
  readonly moduleId: string;
  readonly kind: string;
  readonly title: string;
  readonly order: number;
}

const ok: ValidationResult = { ok: true };

const toResult = (errors: readonly string[]): ValidationResult =>
  errors.length === 0 ? ok : { ok: false, errors };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatUtcDate = (date: Date): string => {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Is this a real calendar date written as zero-padded `YYYY-MM-DD`?
 *
 * Two steps, because the pattern alone is not enough: `'2026-02-30'` matches
 * it and is not a date. The second step appends `T00:00:00Z` and reads the
 * value back with **UTC** getters, so the answer does not depend on the
 * machine's timezone — the same input must not validate differently in CI and
 * on a laptop.
 *
 * Zero-padding is a hard requirement, not a nicety: {@link validateTripDates}
 * compares dates as strings, which is only sound for padded values. Rejecting
 * `'2026-2-1'` here is what makes that comparison honest.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return formatUtcDate(parsed) === value;
}

/** `null` and `undefined` both mean "not given"; everything else is a value. */
const isAbsent = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

function collectRequiredTextErrors(value: string, field: string): string[] {
  if (typeof value !== 'string') {
    return [`${field}: must be a string, received ${typeof value}`];
  }
  if (value.trim().length === 0) {
    return [`${field}: must not be empty`];
  }
  return [];
}

function collectOrderErrors(value: number, field: string): string[] {
  // Number.isInteger already rejects NaN, Infinity and non-numbers, but the
  // explicit typeof keeps the error message truthful about what arrived.
  if (typeof value !== 'number') {
    return [`${field}: must be a number, received ${typeof value}`];
  }
  if (!Number.isInteger(value) || value < 0) {
    return [`${field}: must be a non-negative integer, received ${String(value)}`];
  }
  return [];
}

function collectDateErrors(value: string | null | undefined, field: string): string[] {
  if (isAbsent(value)) {
    return [];
  }
  if (!isIsoDate(value)) {
    return [
      `${field}: must be an ISO calendar date (YYYY-MM-DD), received ${JSON.stringify(value)}`,
    ];
  }
  return [];
}

/** A trip's title must survive a `trim()`. */
export function validateTripTitle(title: string): ValidationResult {
  return toResult(collectRequiredTextErrors(title, 'title'));
}

function collectTripDateErrors(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string[] {
  const errors = [
    ...collectDateErrors(startDate, 'startDate'),
    ...collectDateErrors(endDate, 'endDate'),
  ];

  // Ordering is only meaningful once both sides are known-good dates. Comparing
  // against an unparseable value and reporting it as an ordering problem would
  // send the caller to fix the wrong field.
  if (errors.length > 0 || isAbsent(startDate) || isAbsent(endDate)) {
    return errors;
  }

  // Lexicographic comparison: valid for zero-padded YYYY-MM-DD, and cheaper
  // than parsing. Equality is allowed — a one-day trip is a trip.
  if (startDate > endDate) {
    errors.push(
      `endDate: must not be before startDate (endDate ${endDate} is before startDate ${startDate})`,
    );
  }

  return errors;
}

/**
 * A trip's dates, if both are given, must be in order.
 *
 * Either side may be absent — an undated trip, or one with only a departure
 * pencilled in, is valid. Each given date must still be a real ISO date.
 */
export function validateTripDates(
  startDate?: string | null,
  endDate?: string | null,
): ValidationResult {
  return toResult(collectTripDateErrors(startDate, endDate));
}

/**
 * Validate a trip, at create time or after loading.
 *
 * `userId`, `createdAt` and `updatedAt` are **not** checked: Clerk owns the
 * user id's format and may change it, and the persistence layer owns the
 * timestamps. Asserting anything about them here would be this package
 * guessing at someone else's contract.
 */
export function validateTrip(trip: TripInput): ValidationResult {
  return toResult([
    ...collectRequiredTextErrors(trip.title, 'title'),
    ...collectTripDateErrors(trip.startDate, trip.endDate),
  ]);
}

/**
 * Validate a day: a non-negative integer `order`, and a date that is either a
 * real ISO date or `null` for a deliberately unscheduled day.
 *
 * Whether the date falls inside the parent trip's range is **not** checked —
 * a `TripDay` does not carry its `Trip`, so this function cannot know.
 */
export function validateTripDay(day: TripDayInput): ValidationResult {
  return toResult([
    ...collectOrderErrors(day.order, 'order'),
    ...collectDateErrors(day.date, 'date'),
  ]);
}

/**
 * Validate an item: a non-negative integer `order`, and non-empty
 * `moduleId` / `kind` / `title` — an item naming no module can neither be
 * rendered nor costed.
 *
 * `payload` is not inspected at all. It is `unknown` by design; only the
 * owning module can say whether it is well-formed. `costEstimate` is not
 * checked either — a negative figure is unusual but not obviously wrong (a
 * refund or a credit), and the contract says nothing about it.
 */
export function validateTripItem(item: TripItemInput): ValidationResult {
  return toResult([
    ...collectOrderErrors(item.order, 'order'),
    ...collectRequiredTextErrors(item.moduleId, 'moduleId'),
    ...collectRequiredTextErrors(item.kind, 'kind'),
    ...collectRequiredTextErrors(item.title, 'title'),
  ]);
}
