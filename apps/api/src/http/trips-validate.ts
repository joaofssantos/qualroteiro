/**
 * Request validation for the `/trips*` endpoints.
 *
 * The domain rules come from `@qualroteiro/trips` — they are **not**
 * reimplemented here. What this module adds is the policy that package
 * deliberately refused to invent, on the grounds that doing so "would silently
 * become API policy that `apps/api`'s schema must match"
 * (`packages/trips/README.md`). This is that schema's owner, so this is where
 * those four rules are decided; see specs/005-f2a-trips/plan.md D-501 … D-504.
 *
 * ## Why the package's `ValidationResult` is converted rather than replaced
 *
 * `@qualroteiro/trips` returns a list of field-prefixed errors instead of
 * throwing, precisely so this layer can answer with all of them at once. The
 * house style is a thrown `ValidationError` mapped to `400` in `app.ts`, so
 * {@link assertValid} performs exactly the one-line conversion the package's
 * README prescribes — joining the list rather than discarding all but the
 * first, which is what makes the list worth having.
 */

import {
  type ValidationResult,
  validateTrip,
  validateTripDates,
  validateTripDay,
  validateTripItem,
  validateTripTitle,
} from '@qualroteiro/trips';

import { ValidationError } from '../errors.js';
import type {
  CreateTripDayInput,
  CreateTripItemInput,
  UpdateTripInput,
} from '../store/trips.js';

/**
 * D-501 — the longest title the API accepts, matching `@db.VarChar(200)`.
 * Far past any real trip name, short enough that a runaway paste is rejected
 * at the edge instead of stored.
 */
export const TITLE_MAX_LENGTH = 200;

/**
 * D-502 — `moduleId` and `kind` are free-form, capped only by their column
 * width. No allow-list: F2b–d do not exist yet, and gating their ids here
 * would make every future module wait on an API release.
 */
export const MODULE_ID_MAX_LENGTH = 64;
export const KIND_MAX_LENGTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Turn a `ValidationResult` into the house `400`.
 *
 * The package's messages are already `field: problem`, so the first one's
 * prefix is the field to name; the rest are joined so the client can fix
 * everything in one pass.
 */
function assertValid(result: ValidationResult): void {
  if (result.ok) return;

  const field = result.errors[0]?.split(':')[0]?.trim() ?? 'body';
  throw new ValidationError(field, result.errors.join('; '));
}

/** D-501/D-502's length rule, applied after the package has vouched for the type. */
function assertMaxLength(value: string, field: string, max: number): void {
  if (value.trim().length > max) {
    throw new ValidationError(
      field,
      `${field}: must be at most ${max} characters, received ${value.trim().length}`,
    );
  }
}

function assertObjectBody(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new ValidationError('body', 'body must be a JSON object');
  }
  return body;
}

/** `undefined` (absent key) and `null` both normalise to a stored `null`. */
function normaliseDate(value: unknown): string | null {
  return value === undefined || value === null ? null : (value as string);
}

export interface CreateTripBody {
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

/**
 * Validate a `POST /trips` body.
 *
 * The raw values are handed to `validateTrip` unchecked and uncast-around: the
 * package's guards are written for exactly this caller ("their real caller is
 * an HTTP boundary where `JSON.parse` yields whatever the client sent"), and
 * routing a `42` through them produces a better message than a `typeof` here
 * would.
 */
export function parseCreateTrip(body: unknown): CreateTripBody {
  const record = assertObjectBody(body);

  assertValid(
    validateTrip({
      title: record['title'] as string,
      startDate: record['startDate'] as string | null | undefined,
      endDate: record['endDate'] as string | null | undefined,
    }),
  );

  const title = (record['title'] as string).trim();
  assertMaxLength(title, 'title', TITLE_MAX_LENGTH);

  return {
    title,
    startDate: normaliseDate(record['startDate']),
    endDate: normaliseDate(record['endDate']),
  };
}

/**
 * Validate a `PATCH /trips/:id` body against the trip as it currently stands.
 *
 * The date ordering rule spans two fields, so a patch touching only one of
 * them must still be judged against the other's **stored** value — otherwise
 * `{ startDate: '2026-10-09' }` would be accepted onto a trip ending on the
 * 5th and quietly leave an invalid row.
 */
export function parseUpdateTrip(
  body: unknown,
  current: { readonly startDate: string | null; readonly endDate: string | null },
): UpdateTripInput {
  const record = assertObjectBody(body);

  const patch: {
    title?: string;
    startDate?: string | null;
    endDate?: string | null;
  } = {};

  if ('title' in record) {
    assertValid(validateTripTitle(record['title'] as string));
    const title = (record['title'] as string).trim();
    assertMaxLength(title, 'title', TITLE_MAX_LENGTH);
    patch.title = title;
  }

  const startGiven = 'startDate' in record;
  const endGiven = 'endDate' in record;

  if (startGiven || endGiven) {
    const nextStart = startGiven ? (record['startDate'] as string | null) : current.startDate;
    const nextEnd = endGiven ? (record['endDate'] as string | null) : current.endDate;

    assertValid(validateTripDates(nextStart, nextEnd));

    if (startGiven) patch.startDate = normaliseDate(record['startDate']);
    if (endGiven) patch.endDate = normaliseDate(record['endDate']);
  }

  return patch;
}

/**
 * Validate a `POST /trips/:id/days` body.
 *
 * `order` is optional (§3). When the client omits it the store appends, so the
 * placeholder `0` below is validated in its place — a server-assigned value
 * that is a non-negative integer by construction. When the client *does* send
 * one, that is what gets checked.
 *
 * `date` is **not** checked against the parent trip's range. See plan.md
 * D-503: the trip's dates are mutable through `PATCH`, so that containment is
 * not an invariant this API can actually hold, and asserting it at insert time
 * only would be enforcement theatre.
 */
export function parseCreateDay(body: unknown): CreateTripDayInput {
  const record = assertObjectBody(body ?? {});

  const orderGiven = 'order' in record && record['order'] !== undefined;

  assertValid(
    validateTripDay({
      date: record['date'] as string | null | undefined,
      order: orderGiven ? (record['order'] as number) : 0,
    }),
  );

  const date = normaliseDate(record['date']);

  return orderGiven ? { date, order: record['order'] as number } : { date };
}

/**
 * Validate a `POST /trips/:id/days/:dayId/items` body.
 *
 * `order` is absent from §3's item body, so items always append and the
 * placeholder below stands in for the value the store will assign.
 */
export function parseCreateItem(body: unknown): CreateTripItemInput {
  const record = assertObjectBody(body);

  assertValid(
    validateTripItem({
      moduleId: record['moduleId'] as string,
      kind: record['kind'] as string,
      title: record['title'] as string,
      order: 0,
    }),
  );

  const moduleId = (record['moduleId'] as string).trim();
  const kind = (record['kind'] as string).trim();
  const title = (record['title'] as string).trim();

  assertMaxLength(moduleId, 'moduleId', MODULE_ID_MAX_LENGTH);
  assertMaxLength(kind, 'kind', KIND_MAX_LENGTH);
  assertMaxLength(title, 'title', TITLE_MAX_LENGTH);

  // D-512 — `payload` is required and may not be null. The column is
  // non-nullable, and the contract calls it "o resultado salvo do módulo": an
  // item carrying nothing is not a saved result, it is a row that renders as
  // an empty card forever. `unknown` still means *anything else* goes — the
  // owning module is the only thing that can judge the shape.
  const payload = record['payload'];
  if (payload === undefined || payload === null) {
    throw new ValidationError('payload', 'payload: is required and must not be null');
  }

  return {
    moduleId,
    kind,
    title,
    payload,
    costEstimate: parseCostEstimate(record['costEstimate']),
  };
}

/**
 * D-504 — any finite number, `null`, or absent.
 *
 * Negative is allowed: a refund or a credit is a real line in a budget whose
 * total is a sum. `NaN`/`Infinity` are refused because a `Float` column cannot
 * hold them; neither survives JSON, so nothing legitimate is lost.
 */
function parseCostEstimate(value: unknown): number | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(
      'costEstimate',
      'costEstimate: must be a finite number or null when present',
    );
  }

  return value;
}
