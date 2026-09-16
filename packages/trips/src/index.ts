/**
 * `@qualroteiro/trips` — the F2 composition layer's domain types and their
 * pure validation rules.
 *
 * A `Trip` is a saved plan: ordered `TripDay`s holding `TripItem`s, where each
 * item is one module's saved result (`rota-custos` today; `hospedagem`,
 * `restaurantes`, `atividades` as they ship). Modules stay usable standalone —
 * a trip only composes what they produce.
 *
 * Pure types and functions only. No network I/O, no HTTP client, no
 * persistence, no Clerk. Storage and auth live in `apps/api`.
 *
 * The three entity shapes are FROZEN — see `src/types.ts` and
 * `F2-COORDINATION.md` §3 before changing a field.
 */

export type { Trip, TripDay, TripItem } from './types.js';

export type { TripDayInput, TripInput, TripItemInput, ValidationResult } from './validate.js';
export {
  isIsoDate,
  validateTrip,
  validateTripDates,
  validateTripDay,
  validateTripItem,
  validateTripTitle,
} from './validate.js';
