/**
 * The natural-key slug used as `TollPlazaRecord.id`.
 *
 * ANTT's dataset has no numeric id of its own (see
 * `apps/api/prisma/schema.prisma`'s doc-comment on `TollPlazaRecord.id`), so
 * this job assembles a stable one from the four fields that together
 * identify one physical toll plaza: concessionaire + plaza name + highway +
 * km marker. Checked against the real September-2026 ANTT CSV (277 rows):
 * these four fields are unique for every row — no collisions.
 *
 * Algorithm, applied to each field independently, then joined:
 *   1. Unicode NFKD-normalize the string (decomposes accented letters into a
 *      base letter + combining marks, e.g. "ã" -> "a" + U+0303).
 *   2. Strip combining diacritical marks (U+0300-U+036F) — this is what
 *      actually removes the accent, leaving the bare ASCII letter.
 *   3. Lowercase.
 *   4. Replace every run of characters that are not `a-z`/`0-9` with a
 *      single `-` (this turns spaces, "/", "." and "-" itself all into
 *      plain `-`, so "40.5" -> "40-5" and "BR-101" stays "br-101").
 *   5. Trim leading/trailing `-`.
 * The four per-field slugs are then joined with `-`, dropping any field
 * that slugified to an empty string (so a blank field never produces a
 * doubled `--`).
 *
 * Example (the real "Conselheiro Josino" row used as the fixture for the
 * lat/lng test): concessionaire "AUTOPISTA FLUMINENSE", plaza
 * "Conselheiro Josino", highway "BR-101", km "40.5" ->
 * `autopista-fluminense-conselheiro-josino-br-101-40-5`.
 *
 * Stable across re-ingestion: the same physical plaza in next month's CSV
 * has the same four source fields (ANTT does not rename or remeasure a
 * plaza between monthly snapshots), so it slugifies to the same id and the
 * job's `upsert` updates the existing row instead of creating a duplicate.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Joins the slugified natural-key fields, dropping any empty piece. */
export function naturalKey(fields: readonly string[]): string {
  return fields
    .map(slugify)
    .filter((piece) => piece.length > 0)
    .join('-');
}
