/**
 * Trip domain types — the F2 composition layer.
 *
 * Types and data shapes only — no I/O of any kind.
 *
 * ## These shapes are FROZEN
 *
 * They are transcribed from `F2-COORDINATION.md` §3, the contract negotiated
 * with the PE before this package existed. `apps/api` (Prisma schema and
 * `/trips*` endpoints) and `apps/web` (the "Planejamento de Viagem" module)
 * are both written against it, the web side concurrently with this file.
 *
 * Renaming a field, or making one optional, silently breaks them. If a shape
 * here turns out to be wrong, change `F2-COORDINATION.md` first and say so in
 * its progress log — do not fix it quietly here.
 *
 * `readonly` is the one addition, and it is compile-time only: it does not
 * change the JSON on the wire, it just stops this process from mutating a
 * value it does not own.
 */

/**
 * A saved trip: the container a user composes module results into.
 *
 * Days and items are *not* inlined here. The `GET /trips/:id` response nests
 * them (`{ ...Trip, days: (TripDay & { items: TripItem[] })[] }`), but that is
 * a response shape owned by `apps/api`; the entity itself is flat, matching
 * how it is stored.
 */
export interface Trip {
  readonly id: string;
  /**
   * The owning Clerk user id.
   *
   * Opaque here — this package neither parses nor validates it, because its
   * format is Clerk's to change. Ownership checks live in the API middleware.
   */
  readonly userId: string;
  readonly title: string;
  /** ISO calendar date, `YYYY-MM-DD`, e.g. `'2026-10-01'`. `null` if undated. */
  readonly startDate: string | null;
  /** ISO calendar date, `YYYY-MM-DD`. `null` if undated. */
  readonly endDate: string | null;
  /** ISO datetime. Set by the persistence layer, never by this package. */
  readonly createdAt: string;
  /** ISO datetime. Set by the persistence layer, never by this package. */
  readonly updatedAt: string;
}

/** One day of a {@link Trip}: an ordered bucket that holds {@link TripItem}s. */
export interface TripDay {
  readonly id: string;
  readonly tripId: string;
  /**
   * ISO calendar date, `YYYY-MM-DD`.
   *
   * `null` means an intentionally **unscheduled** day — a user can plan "some
   * day on this trip" before committing to a date. It is not a missing value.
   */
  readonly date: string | null;
  /** Display order within the trip. A non-negative integer; 0-based. */
  readonly order: number;
}

/**
 * One saved module result, placed on a {@link TripDay}.
 *
 * This is the seam that makes a trip composable: the timeline renders and
 * sums items without knowing what any module actually produced.
 */
export interface TripItem {
  readonly id: string;
  readonly tripDayId: string;
  /** Display order within the day. A non-negative integer; 0-based. */
  readonly order: number;
  /**
   * Which module produced this item, e.g. `'rota-custos'`, `'hospedagem'`,
   * `'restaurantes'`, `'atividades'`.
   *
   * Deliberately a plain `string`, not a union: F2b–d add modules, and this
   * package has no business knowing the module registry. Validation checks it
   * is non-empty, not that it is a *known* module.
   */
  readonly moduleId: string;
  /** Free-form per module, e.g. `'route'` for `rota-custos`. */
  readonly kind: string;
  /** Label shown on the timeline, e.g. `'São Paulo → Rio de Janeiro'`. */
  readonly title: string;
  /**
   * The module's saved result — a `PlannedRoute` for `rota-custos`, whatever
   * `hospedagem` saves later.
   *
   * `unknown`, not `any` and not a union of module payloads: the owning module
   * is the only code that can interpret it, and a union here would make this
   * package depend on every module that will ever exist. Callers must narrow.
   */
  readonly payload: unknown;
  /**
   * Cost in BRL for the consolidated trip budget, or `null` when the item has
   * no cost (or none is known yet). Summing is the caller's job.
   */
  readonly costEstimate: number | null;
}
