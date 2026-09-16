/**
 * `TollPlazaStore` — the port over the persisted `TollPlazaRecord` table
 * (T5 Wave 2, `j-20260916-9y`).
 *
 * Same reasoning as `store/trips.ts` and `store/api-usage.ts`: a port, not a
 * concrete Prisma type, is what lets `routes/plan.ts`'s use of real toll
 * plazas be proven with an in-memory fake and no database. `listActive()` is
 * the ONLY thing `POST /routes/plan` reads — it feeds `matchTolls`'s
 * `plazas` list, replacing `@qualroteiro/tolls`'s in-package demo seed on the
 * production path (the seed itself keeps existing, used only by that
 * package's own tests). `status()` is the second and only other read,
 * backing `GET /admin/toll-plazas-status`.
 */

/** One row of the persisted, real-world toll plaza table. */
export interface TollPlazaRecord {
  /** Stable natural key — see `prisma/schema.prisma`'s doc-comment. */
  readonly id: string;
  readonly concessionaire: string;
  readonly name: string;
  readonly highway: string;
  readonly uf: string;
  readonly municipality: string;
  readonly km: number;
  readonly lat: number;
  readonly lng: number;
  /** Mirrors ANTT's `situacao` column as of the most recent ingestion. */
  readonly active: boolean;
  /** When this row was last written. */
  readonly ingestedAt: Date;
}

/** `GET /admin/toll-plazas-status`'s own shape, read straight off the table. */
export interface TollPlazaStatus {
  /** Every row currently stored, active or not. */
  readonly count: number;
  /** The most recent `ingestedAt` across every row, or `null` when the table is empty. */
  readonly lastIngestedAt: Date | null;
}

export interface TollPlazaStore {
  /**
   * Every plaza currently marked `active`, in no particular order —
   * `matchTolls` sorts its own matches by position along the route, so this
   * store owes the caller no ordering.
   *
   * An empty table (before Wave 3's ingestion job has ever run) is a normal,
   * expected state, not an error: this resolves to `[]`, and `/routes/plan`
   * proceeds with zero tolls rather than failing.
   */
  listActive(): Promise<readonly TollPlazaRecord[]>;

  /** Aggregate counts for `GET /admin/toll-plazas-status`. */
  status(): Promise<TollPlazaStatus>;
}
