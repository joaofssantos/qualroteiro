/**
 * Parses ANTT's toll-plaza CSV (already decoded to a JS string — see
 * `decode.ts` for the ISO-8859-1 byte-decoding step) into
 * {@link TollPlazaRecordInput} rows ready to upsert.
 *
 * Real header, confirmed against the September-2026 dataset (277 rows,
 * `dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d`):
 *
 * ```
 * concessionaria;praca_de_pedagio;ano_do_pnv_snv;rodovia;uf;km_m;municipal;
 * tipo_de_pista;sentido;situacao;data_da_inativacao;latitude;longitude
 * ```
 *
 * Delimiter is `;`, not `,`. No quoted fields and no embedded delimiters
 * were found anywhere in the real file (every one of the 277 data lines
 * splits into exactly 13 fields on a plain `;`), so this is a plain
 * split-based parser rather than a full CSV grammar — simpler, and correct
 * for the one file it needs to read.
 */

import { naturalKey } from './slug.js';

/** One row this job is prepared to write to `TollPlazaRecord`. */
export interface TollPlazaRecordInput {
  readonly id: string;
  readonly concessionaire: string;
  readonly name: string;
  readonly highway: string;
  readonly uf: string;
  readonly municipality: string;
  readonly km: number;
  readonly lat: number;
  readonly lng: number;
  readonly active: boolean;
  readonly ingestedAt: Date;
}

export interface ParseError {
  /** 1-indexed line number in the source CSV (line 1 is the header). */
  readonly line: number;
  readonly reason: string;
}

export interface ParseResult {
  /** Data rows read, header excluded. */
  readonly totalRows: number;
  /**
   * Rows with `situacao === 'Ativo'` that parsed cleanly — these are the
   * only ones the job upserts. See {@link parseAnttTollPlazaCsv}'s doc
   * comment for why inactive rows are skipped rather than written with
   * `active: false`.
   */
  readonly activeRecords: readonly TollPlazaRecordInput[];
  /** Rows read with any `situacao` other than `'Ativo'` — counted, not written. */
  readonly inactiveSkipped: number;
  /** Malformed rows (wrong column count, unparseable number) — counted, not written. */
  readonly errors: readonly ParseError[];
}

const EXPECTED_HEADER = [
  'concessionaria',
  'praca_de_pedagio',
  'ano_do_pnv_snv',
  'rodovia',
  'uf',
  'km_m',
  'municipal',
  'tipo_de_pista',
  'sentido',
  'situacao',
  'data_da_inativacao',
  'latitude',
  'longitude',
] as const;

/** `"40.5"` or `"40,5"` -> `40.5`. `NaN` for anything else. */
function parseDecimal(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') return NaN;
  return Number(normalized);
}

/**
 * Parses the full CSV text into active/inactive/error buckets.
 *
 * **Filter, not a flag**: only `situacao === 'Ativo'` rows are turned into
 * {@link TollPlazaRecordInput}s and returned in `activeRecords`. Everything
 * else is counted in `inactiveSkipped` and dropped. This is a deliberate
 * reading of this unit's brief ("Filtra `situacao === 'Ativo'`" as a step
 * before the upsert, and the acceptance test's own wording — "filtra
 * inativa") over `TollPlazaRecord.active`'s doc-comment, which speculates
 * about a plaza later being "reactivated" onto the same row. Consequence,
 * documented as a known limitation (see `README.md`): a plaza that
 * *becomes* inactive between two monthly runs is simply never touched again
 * by this job — its existing row is left stale with `active: true` in the
 * database, rather than being flipped to `false`. Given the real dataset
 * currently has zero inactive rows (all 277 are `Ativo`), this is a
 * low-probability, low-blast-radius simplification for V1, not an oversight.
 *
 * `ingestedAt` is stamped onto every record from the `ingestedAt` parameter
 * (the caller's "now"), not derived from the CSV — ANTT's file carries no
 * "published at" column.
 */
export function parseAnttTollPlazaCsv(csvText: string, ingestedAt: Date): ParseResult {
  const lines = csvText.split(/\r\n|\r|\n/).filter((line, index, all) => {
    // Drop a single trailing blank line (a trailing newline in the file),
    // but keep genuinely blank data lines so they surface as row errors.
    return !(line === '' && index === all.length - 1);
  });

  const errors: ParseError[] = [];

  if (lines.length === 0) {
    return { totalRows: 0, activeRecords: [], inactiveSkipped: 0, errors: [] };
  }

  const header = (lines[0] ?? '').split(';').map((cell) => cell.trim());
  const headerIsExpected =
    header.length === EXPECTED_HEADER.length &&
    EXPECTED_HEADER.every((name, index) => header[index] === name);
  if (!headerIsExpected) {
    errors.push({
      line: 1,
      reason: `unexpected header — got "${header.join(';')}", expected "${EXPECTED_HEADER.join(';')}"`,
    });
    return { totalRows: lines.length - 1, activeRecords: [], inactiveSkipped: 0, errors };
  }

  const activeRecords: TollPlazaRecordInput[] = [];
  let inactiveSkipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1; // 1-indexed, header is line 1
    const raw = lines[i] ?? '';
    if (raw.trim() === '') {
      errors.push({ line: lineNumber, reason: 'blank line' });
      continue;
    }

    const cells = raw.split(';');
    if (cells.length !== EXPECTED_HEADER.length) {
      errors.push({
        line: lineNumber,
        reason: `expected ${EXPECTED_HEADER.length} columns, got ${cells.length}`,
      });
      continue;
    }

    const row = Object.fromEntries(
      EXPECTED_HEADER.map((name, index) => [name, (cells[index] ?? '').trim()]),
    ) as Record<(typeof EXPECTED_HEADER)[number], string>;

    if (row.situacao !== 'Ativo') {
      inactiveSkipped++;
      continue;
    }

    const km = parseDecimal(row.km_m);
    const lat = parseDecimal(row.latitude);
    const lng = parseDecimal(row.longitude);

    if (!Number.isFinite(km) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      errors.push({
        line: lineNumber,
        reason: `unparseable number (km_m="${row.km_m}", latitude="${row.latitude}", longitude="${row.longitude}")`,
      });
      continue;
    }

    activeRecords.push({
      id: naturalKey([row.concessionaria, row.praca_de_pedagio, row.rodovia, row.km_m]),
      concessionaire: row.concessionaria,
      name: row.praca_de_pedagio,
      highway: row.rodovia,
      uf: row.uf.toUpperCase(),
      municipality: row.municipal,
      km,
      // CRITICAL: `latitude` -> `lat`, `longitude` -> `lng`, same axis, no
      // swap. See `tests/antt-csv.test.ts`'s "Conselheiro Josino" case,
      // which asserts this against a real row byte-for-byte.
      lat,
      lng,
      active: true,
      ingestedAt,
    });
  }

  return { totalRows: lines.length - 1, activeRecords, inactiveSkipped, errors };
}
