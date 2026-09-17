/**
 * Downloads and parses ARTESP's official "Valor Atual das Tarifas" PDF —
 * `~124` (real count: see below) toll plazas across every state-highway
 * concessionaire in São Paulo, laid out as one small table per
 * concessionaire (`Concessionária -> Rodovia -> Praça -> KM -> Passeio (R$)
 * -> Comercial por eixo (R$) [-> Motos (R$)]`). No coordinate of any kind
 * appears anywhere in the document — see `.aipe/journeys/j-20260916-x3/orientation.md`
 * decision #1 for why this journey is an audit/report, not a new
 * `TollPlazaRecord` source.
 *
 * ## Real document shape (confirmed 2026-09-17 against the live PDF)
 *
 * - `GET`, no auth, `application/pdf`, 1,257,140 bytes, `last-modified:
 *   2025-12-02` — matches orientation.md's own research exactly.
 * - **136 real rows** in the simple 2/3-column format this module parses
 *   (not "~124" — orientation.md's number was a rough estimate from an
 *   earlier pass; the precise count, cross-checked two independent ways —
 *   this module's row parser, and a standalone `R$ ... R$ ...` occurrence
 *   count over the raw extracted text — agree exactly).
 * - **11 additional rows** under one concessionaire (`L29 - ViaPaulista`,
 *   NOT "Rodovias do Tietê" as orientation.md's research pass guessed —
 *   Rodovias do Tietê is a real concessionaire in this document, but it
 *   uses the same simple 3-column format as everyone else; ViaPaulista is
 *   the one with the different table) use a wholly different layout: a
 *   `Multiplicador / Tipo (CAT-1..9) / Sem arredondar / Manual / AVI` table,
 *   one such block per plaza. **Deliberately excluded from this V1 parser**
 *   (`excludedCatFormatCount` below) — seeing this in the real document
 *   confirmed the format-diversity orientation.md called out, but building a
 *   second parser for 11 of ~147 total rows (7%) was judged not worth the
 *   effort for an audit tool whose main job is the other 136. Never silent:
 *   the count is captured and surfaced, not swallowed.
 * - **`PASSEIO` and `COMERCIAL POR EIXO` are numerically identical on every
 *   one of the 136 rows** — a genuine finding, not a parsing bug (confirmed
 *   twice: once against the raw extracted text with a standalone regex
 *   cross-check, once structurally against every parsed row). This matches
 *   Brazilian "tarifa quilométrica" convention: `COMERCIAL POR EIXO` is a
 *   *per-axle* base rate that happens to equal the car (`PASSEIO`) rate at
 *   every plaza in this document — a loaded truck's real toll is
 *   `COMERCIAL POR EIXO × number of axles`, not a second flat category. See
 *   `artesp-compare.ts` for how this shapes the OSM `truck_N_axle` comparison.
 *
 * ## Why a hand-rolled layout reconstruction, not `pdf-parse`'s default text
 *
 * A quick comparison of `pdftotext`'s two modes against the real PDF (done
 * as research before writing this module) showed its default reading-order
 * text is *column-major*, not row-major — this PDF's underlying table
 * library draws one whole column's cells, then the next, so plain
 * extraction interleaves unrelated rows and concessionaire headers into
 * useless order. `-layout` mode (positional reconstruction) is what
 * actually works. `pdfjs-dist`'s `getTextContent()` exposes each text run's
 * `x`/`y` (via `item.transform`), so {@link extractArtespPdfLines}
 * reimplements the same idea directly: group text items into physical lines
 * by `y` (within a small tolerance — real per-character baseline jitter is
 * ~1-2pt, real inter-row spacing is comfortably larger), sort each line's
 * items by `x`, and re-insert 2+ spaces wherever the horizontal gap between
 * two consecutive items exceeds roughly 1.5 character widths — the same
 * "column gap" heuristic `pdftotext -layout` itself uses. This keeps the
 * package dependency-light (`pdfjs-dist` only, no system `poppler` binary
 * required in prod/CI) while producing output {@link parseArtespTarifaLines}
 * can chunk on `/\s{2,}/`.
 */

import { naturalKey } from './slug.js';

// Type-only — erased at compile time, so this does NOT eagerly load
// `pdfjs-dist` itself (see `extractArtespPdfLines`'s lazy `await import(...)`
// for the actual value import, kept lazy so a test exercising only
// `parseArtespTarifaLines` against literal fixture lines never pays for it).
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

export const ARTESP_TARIFAS_PDF_URL =
  'https://www.artesp.sp.gov.br/dx/api/dam/v1/collections/aa4b6398-685b-4dba-8fab-8dc3a0fe9c27/items/0a8ff7b8-005b-4a04-a152-c69236f1f15d/renditions/53b3922a-a33b-40f6-9e4c-46a6771e681d?binary=true';

/** One plaza row from ARTESP's simple (Passeio/Comercial[/Motos]) table format. */
export interface ArtespTollRow {
  /** Stable key for this row: `roadCode` + `plazaName` + `kmRaw`, same
   * slugging approach as `slug.ts` — used only for de-duplication/logging in
   * this module, never written as a `TollPlazaRecord.id` (this job never
   * writes that table — see this module's doc-comment). */
  readonly id: string;
  /** Best-effort text reconstruction of the concessionaire header text above
   * this row's table section (e.g. `"Concessionária do Sistema
   * Anhanguera-Bandeirantes S.A. - AUTOBAN"`). NOT used by `artesp-match.ts`
   * as a filter or scoring signal (see that module's doc-comment for why) —
   * display-only, and known to be noisy/incomplete for some sections (a
   * concessionaire's own name sometimes wraps across several physical PDF
   * lines interleaved with structural header tokens in a way this best-effort
   * reconstruction does not always fully separate). */
  readonly concessionaire: string;
  /** The official highway code, e.g. `"SP-330"`. Reliable — always read
   * directly off the row's own terminal line, never subject to the
   * multi-line join heuristic below. */
  readonly roadCode: string;
  /** The highway's proper name, e.g. `"Via Anhanguera"`. Best-effort:
   * reconstructed by joining this row's terminal line with at most one
   * immediately-preceding and one immediately-following physical PDF line
   * when the highway name wraps — see "Multi-line cells" below. May
   * occasionally carry a stray leading word bled in from the previous
   * section's concessionaire header text on a section's very first row
   * (cosmetic only — never affects `roadCode`/`kmRaw`/tariffs, and never used
   * by `artesp-match.ts`, which matches on `plazaName` alone). */
  readonly roadName: string;
  /** The plaza's own name/label, e.g. `"PERUS"`. Best-effort, same join
   * heuristic as `roadName` — see "Multi-line cells" below for the one
   * documented case (a 4-row SPMAR "Trecho Leste" sub-table) where a name
   * that wraps across 3+ physical lines comes out truncated rather than
   * fully joined. */
  readonly plazaName: string;
  /** Raw ARTESP km marker, e.g. `"026+495"` (kilometres+metres notation). */
  readonly kmRaw: string;
  /** `kmRaw` parsed to a plain kilometre float (e.g. `26.495`). `NaN` if
   * `kmRaw` didn't match the expected `NNN+NNN` shape — never thrown; see
   * `artesp-match.ts`, which does not use this field at all (no ANTT/OSM-side
   * km to compare it against). Kept for report readability only. */
  readonly km: number;
  /** ARTESP's "Passeio" column (car tariff), in BRL. */
  readonly tariffPasseio: number;
  /** ARTESP's "Comercial por eixo" column (per-axle heavy-vehicle base
   * rate), in BRL — see this module's doc-comment: numerically identical to
   * `tariffPasseio` on every real row in the current document, but kept as
   * its own field rather than assumed equal (a future ARTESP revision could
   * legitimately diverge the two, and the parser should keep reading
   * whatever the document actually says). */
  readonly tariffComercialPorEixo: number;
  /** ARTESP's "Motos" column, in BRL — present only for the concessionaires
   * whose section header declares a 3rd column (about 43% of the 136 real
   * rows). `undefined`, not `null`/`NaN`, when the column is absent for this
   * row's section, or when a non-numeric placeholder appears in its place
   * (the real document has exactly one such case: `"Não Aplica"` on one
   * Rodoanel Trecho Oeste row, in a section whose header does not even
   * declare a MOTOS column — this parser tolerates it rather than crashing,
   * since a 3rd token not shaped like `R$ <number>` is simply not captured as
   * a tariff). */
  readonly tariffMotos?: number;
}

export interface ArtespParseResult {
  readonly rows: readonly ArtespTollRow[];
  /** Count of praças seen in the CAT-1..9 multiplier-table format (the `L29
   * - ViaPaulista` concessionaire) — deliberately not parsed by this V1
   * parser. Real value: 11. See this module's doc-comment. */
  readonly excludedCatFormatCount: number;
}

/** `SP-330`, `SP- 065` (a real space-before-digits quirk in the source PDF),
 * `SPA-086/021`, `SPI 097/055` — every highway-code shape seen in the real
 * document's simple-format section. */
const SP_CODE_RE = /^SP[AI]?[\s-]*\d{2,3}(?:\/\d{2,3})?$/i;
/** ARTESP's km-marker notation: kilometres `+` metres, e.g. `026+495`,
 * `66+700`, `0+300`. */
const KM_RE = /^\d{1,3}\+\d{3}$/;
const MONEY_RE = /^R\$\s*[\d.,]+$/;

/** Table-chrome tokens that repeat at the top of every concessionaire
 * section (and, for the CAT block, its own distinct headers) — never a real
 * highway/plaza-name fragment, so any line containing one of these is
 * skipped rather than folded into a row. */
const STRUCTURAL_RE =
  /LOTE\b|PASSEIO\b|COMERCIAL POR EIXO|MOTOS\b|LOCALIZAÇ|PRAÇAS DE PEDÁGIO|PEDÁGIOS CONCEDIDOS|Multiplicador|Sem arredondar|^Anexo\b|^Vigência|^\d{2}\/\d{2}\/\d{4}$/;
/** Marks a line as belonging to the CAT-1..9 format (see this module's
 * doc-comment) — `CAT-1` itself doubles as the per-plaza-block counter. */
const CAT_LINE_RE = /CAT-\d|^set\/\d{2}\b|^Tipo\b/;
const CAT_BLOCK_MARKER_RE = /CAT-1\b/;

function isStructuralLine(line: string): boolean {
  return STRUCTURAL_RE.test(line);
}

function isCatFormatLine(line: string): boolean {
  return CAT_LINE_RE.test(line);
}

/** Splits a reconstructed layout line into column chunks — 2+ consecutive
 * spaces is this format's column-gap convention (both `pdftotext -layout`
 * and {@link extractArtespPdfLines}'s own reconstruction use it). */
function splitChunks(line: string): string[] {
  return line
    .split(/\s{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

function parseMoneyChunk(chunk: string): number {
  const normalized = chunk.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Returns the parsed `{codeIdx, kmIdx, moneyChunks}` shape of a line's
 * chunks if it is shaped like a complete row (has a highway code, a km
 * marker after it, and at least 2 money values) — otherwise `null`. Used
 * both for the main per-line loop and for the pending/lookahead safety
 * checks (a line that already looks like a complete row of its own must
 * never be folded into a neighbour's highway/name — see the "Multi-line
 * cells" section of {@link parseArtespTarifaLines}). */
function tryParseTerminalChunks(
  chunks: readonly string[],
): { codeIdx: number; kmIdx: number; moneyChunks: string[] } | null {
  const codeIdx = chunks.findIndex((chunk) => SP_CODE_RE.test(chunk));
  if (codeIdx < 0) return null;
  const kmIdx = chunks.findIndex((chunk, idx) => idx > codeIdx && KM_RE.test(chunk));
  if (kmIdx < 0) return null;
  const moneyChunks = chunks.filter((chunk) => MONEY_RE.test(chunk));
  if (moneyChunks.length < 2) return null;
  return { codeIdx, kmIdx, moneyChunks };
}

/**
 * Parses ARTESP's simple-format table rows out of already-reconstructed
 * layout text lines (see {@link extractArtespPdfLines} for how those lines
 * are produced from real PDF bytes) — kept as a pure function over
 * `string[]` so tests can feed literal fixture lines (real single-row
 * examples, both with and without a `MOTOS` column) without needing a real
 * PDF binary.
 *
 * ## Multi-line cells
 *
 * A row's highway name and/or plaza name sometimes wraps across more than
 * one physical PDF line (the source table has narrow columns; a long
 * concessionaire's road name like `"Rodovia Gov. Dr. Adhemar\nPereira de
 * Barros"` visually wraps). This parser always reads `roadCode`/`kmRaw`/the
 * tariff columns from exactly one line — the row's "terminal" line, the one
 * carrying the km marker and money values, detected by
 * {@link tryParseTerminalChunks} — and only *additionally* borrows column
 * text from:
 *
 * 1. The single immediately-**preceding** physical line, if it does not
 *    itself look like a complete row (guards against grafting the *previous*
 *    row's own text onto this one when two single-line rows sit back to
 *    back — confirmed necessary against a real case, "VALINHOS" printed
 *    twice at two different km markers).
 * 2. The single immediately-**following** physical line, but *only* when
 *    this row's own terminal line carried no plaza-name text at all
 *    (`codeIdx` right at the start of the line, name chunk empty). This
 *    narrow trigger matches the one real section that needs a trailing
 *    continuation (SPMAR's "Trecho Leste" sub-table, where both the highway
 *    and plaza name are empty on the terminal line itself) while not
 *    misfiring on an ordinary complete row followed by an unrelated
 *    section's next-row header text (confirmed necessary against a second
 *    real case — see `tests/artesp-pdf.test.ts`).
 *
 * This 1-line/1-line window is a deliberate, bounded choice, not an
 * exhaustive multi-line-table reconstruction: one small real sub-table (4
 * plazas, SPMAR "Trecho Leste") wraps a plaza name across *three* physical
 * lines (one before AND one after the 1-line window this parser looks at).
 * For those 4 rows specifically, `plazaName` comes out missing its first
 * and/or last word (e.g. `"Externa) / Trecho Leste - Ayrton"` instead of the
 * full `"Praça Leste 5 e 6 (Alça Interna e Externa) / Trecho Leste - Ayrton
 * Senna"`) — `roadCode`/`kmRaw`/every tariff value for those 4 rows is
 * unaffected (always read from the terminal line alone), and the truncated
 * name is still distinctive enough that `artesp-match.ts`'s fuzzy matching
 * tolerates it (or, worst case, the row surfaces as "ARTESP sem match" —
 * an honestly-reported outcome, not a silent wrong answer).
 */
export function parseArtespTarifaLines(rawLines: readonly string[]): ArtespParseResult {
  const rows: ArtespTollRow[] = [];
  let excludedCatFormatCount = 0;
  // Best-effort concessionaire-label accumulator: every non-structural,
  // non-row, non-CAT line seen since the last row closed, drained (and
  // collapsed to one string) each time a row is produced. See
  // `ArtespTollRow.concessionaire`'s doc-comment — display-only, noisy for
  // some sections, never used by `artesp-match.ts`.
  let headerBuffer: string[] = [];
  let currentConcessionaire = '';

  let i = 0;
  while (i < rawLines.length) {
    const line = (rawLines[i] ?? '').trim();
    if (line === '') {
      i++;
      continue;
    }

    if (CAT_BLOCK_MARKER_RE.test(line)) excludedCatFormatCount++;
    if (isCatFormatLine(line) || isStructuralLine(line)) {
      i++;
      continue;
    }

    const chunks = splitChunks(line);
    const terminal = tryParseTerminalChunks(chunks);
    if (terminal === null) {
      // Not a complete row on its own — could be a concessionaire header
      // fragment, or a wrap-continuation for a neighbouring row. The
      // pending/lookahead logic below re-reads this same line by index when
      // we reach a neighbouring terminal line; here it only feeds the
      // best-effort concessionaire buffer.
      headerBuffer.push(line);
      i++;
      continue;
    }

    const { codeIdx, kmIdx, moneyChunks } = terminal;
    let highwayParts = chunks.slice(0, codeIdx);
    let nameParts = chunks.slice(codeIdx + 1, kmIdx);
    const terminalOwnNameEmpty = nameParts.length === 0;

    // (1) Pending: the single immediately-preceding line, if it exists and
    // isn't itself a complete row or table chrome.
    const pendingLineRaw = i > 0 ? (rawLines[i - 1] ?? '').trim() : '';
    if (
      pendingLineRaw &&
      !isStructuralLine(pendingLineRaw) &&
      !isCatFormatLine(pendingLineRaw) &&
      tryParseTerminalChunks(splitChunks(pendingLineRaw)) === null
    ) {
      const pendingChunks = splitChunks(pendingLineRaw);
      const first = pendingChunks[0];
      const second = pendingChunks[1];
      if (pendingChunks.length === 1 && first !== undefined) {
        highwayParts = [first, ...highwayParts];
      } else if (pendingChunks.length >= 2 && first !== undefined && second !== undefined) {
        highwayParts = [first, ...highwayParts];
        nameParts = [second, ...nameParts];
      }
      // This line was already pushed to `headerBuffer` on the previous
      // iteration (it wasn't a terminal line then either) — now that it's
      // been folded into THIS row's highway/name instead, drop it from the
      // concessionaire buffer so it isn't double-counted as header text too.
      if (headerBuffer[headerBuffer.length - 1] === pendingLineRaw) {
        headerBuffer = headerBuffer.slice(0, -1);
      }
    }

    // (2) Lookahead: only when this row's OWN terminal line carried no plaza
    // name at all — see this function's doc-comment.
    const lookaheadLineRaw = i + 1 < rawLines.length ? (rawLines[i + 1] ?? '').trim() : '';
    let consumedLookahead = false;
    if (
      terminalOwnNameEmpty &&
      lookaheadLineRaw &&
      !isStructuralLine(lookaheadLineRaw) &&
      !isCatFormatLine(lookaheadLineRaw) &&
      tryParseTerminalChunks(splitChunks(lookaheadLineRaw)) === null
    ) {
      const lookaheadChunks = splitChunks(lookaheadLineRaw);
      const first = lookaheadChunks[0];
      const second = lookaheadChunks[1];
      if (lookaheadChunks.length === 1 && first !== undefined) {
        highwayParts = [...highwayParts, first];
        consumedLookahead = true;
      } else if (lookaheadChunks.length >= 2 && first !== undefined && second !== undefined) {
        highwayParts = [...highwayParts, first];
        nameParts = [...nameParts, second];
        consumedLookahead = true;
      }
    }

    // Best-effort concessionaire label: every non-structural, non-row,
    // non-CAT line seen since the last row closed, collapsed to one string.
    // Only updates `currentConcessionaire` when new header text was actually
    // seen — most rows within a section have none (the header only appears
    // once, before the section's first row), so an empty buffer means "still
    // the same concessionaire as the previous row", not "unknown". Not reset
    // on a precise per-section boundary (see this module's doc-comment on
    // `concessionaire` — known to be noisy for some sections; display-only,
    // never used for matching).
    const newHeaderText = collapseWhitespace(headerBuffer.join(' '));
    if (newHeaderText) currentConcessionaire = newHeaderText;
    headerBuffer = [];

    const roadCode = chunks[codeIdx] ?? '';
    const kmRawChunk = chunks[kmIdx] ?? '';
    const kmMatch = /^(\d{1,3})\+(\d{3})$/.exec(kmRawChunk);
    const km = kmMatch
      ? Number(kmMatch[1]) + Number(kmMatch[2]) / 1000
      : Number.NaN;

    const tariffPasseio = parseMoneyChunk(moneyChunks[0] ?? '');
    const tariffComercialPorEixo = parseMoneyChunk(moneyChunks[1] ?? '');
    const thirdMoney = moneyChunks[2];
    const tariffMotos = thirdMoney !== undefined ? parseMoneyChunk(thirdMoney) : undefined;

    const roadName = collapseWhitespace(highwayParts.join(' '));
    const plazaName = collapseWhitespace(nameParts.join(' '));

    rows.push({
      id: naturalKey([roadCode, plazaName, kmRawChunk]),
      concessionaire: currentConcessionaire,
      roadCode,
      roadName,
      plazaName,
      kmRaw: kmRawChunk,
      km,
      tariffPasseio,
      tariffComercialPorEixo,
      ...(tariffMotos !== undefined ? { tariffMotos } : {}),
    });

    i += consumedLookahead ? 2 : 1;
  }

  return { rows, excludedCatFormatCount };
}

/**
 * Downloads the raw PDF bytes.
 *
 * @param fetchImpl Injectable for tests; defaults to global `fetch` — same
 *   pattern as `download.ts`'s `downloadAnttTollPlazaCsv`.
 */
export async function downloadArtespTarifasPdf(
  url: string = ARTESP_TARIFAS_PDF_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`ARTESP PDF download failed: HTTP ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Character-width multiple beyond which a horizontal gap between two text
 * items on the same physical line is rendered as 2+ spaces (a new "column")
 * rather than folded into the same word/chunk — mirrors `pdftotext
 * -layout`'s own column-gap convention closely enough to feed
 * {@link parseArtespTarifaLines}'s `/\s{2,}/` chunking. */
const COLUMN_GAP_CHAR_WIDTHS = 1.5;
/** Vertical tolerance (PDF points) for clustering text items into one
 * physical line. Calibrated against the real document: baseline jitter
 * between items nominally on the same visual row is ~1-2pt; real row-to-row
 * spacing is comfortably larger (the smallest font in this document is
 * ~6.2pt tall). */
const LINE_Y_TOLERANCE = 2.2;

/**
 * Reconstructs `pdftotext -layout`-shaped text lines from real PDF bytes,
 * using `pdfjs-dist`'s positional text extraction (`item.transform`'s `x`/`y`)
 * rather than its default reading order — see this module's doc-comment for
 * why the default order is unusable for this specific document.
 */
export async function extractArtespPdfLines(pdfBytes: Uint8Array): Promise<string[]> {
  // Imported lazily (not at module top) so a test that only exercises
  // `parseArtespTarifaLines` against literal fixture lines never pays the
  // cost of loading `pdfjs-dist`.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await getDocument({ data: pdfBytes, useSystemFonts: true, verbosity: 0 }).promise;
  const lines: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      // `content.items` is `(TextItem | TextMarkedContent)[]` — only
      // `TextItem` carries `str`/`transform`/`width` (`TextMarkedContent` is
      // a begin/end marker with no text of its own); `'transform' in item` is
      // the real discriminant TypeScript can narrow on ('str' alone isn't:
      // both branches structurally satisfy `'str' in item` from the
      // checker's point of view).
      const items = content.items
        .filter((item): item is TextItem => 'transform' in item && item.str.trim() !== '')
        .map((item) => ({
          str: item.str,
          x: item.transform[4] ?? 0,
          y: item.transform[5] ?? 0,
          width: item.width,
        }));

      // Top-to-bottom (PDF y grows upward, hence descending), then
      // left-to-right within a line.
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      type LineGroup = { y: number; items: typeof items };
      const lineGroups: LineGroup[] = [];
      let current: LineGroup | null = null;
      for (const item of items) {
        if (current === null || Math.abs(item.y - current.y) > LINE_Y_TOLERANCE) {
          current = { y: item.y, items: [item] };
          lineGroups.push(current);
        } else {
          current.items.push(item);
        }
      }

      for (const group of lineGroups) {
        const rowItems = [...group.items].sort((a, b) => a.x - b.x);
        let text = '';
        let prevEnd: number | null = null;
        for (const item of rowItems) {
          const charWidth = item.width / Math.max(item.str.length, 1) || 4;
          if (prevEnd === null) {
            text += item.str;
          } else {
            const gap = item.x - prevEnd;
            const spaces =
              gap > charWidth * COLUMN_GAP_CHAR_WIDTHS
                ? Math.max(2, Math.round(gap / (charWidth || 4)))
                : gap > charWidth * 0.3
                  ? 1
                  : 0;
            text += ' '.repeat(spaces) + item.str;
          }
          prevEnd = item.x + item.width;
        }
        lines.push(text);
      }
    }
  } finally {
    await doc.destroy();
  }

  return lines;
}

/** Convenience wrapper: download, reconstruct layout text, and parse — what
 * `artesp-audit.ts`/the CLI actually call. Split into its three constituent
 * exports above so each is independently testable (network-free parser
 * tests, and a layout-reconstruction step that never needs mocking a
 * Postgres client). */
export async function downloadAndParseArtespTarifas(
  url: string = ARTESP_TARIFAS_PDF_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<ArtespParseResult> {
  const pdfBytes = await downloadArtespTarifasPdf(url, fetchImpl);
  const lines = await extractArtespPdfLines(pdfBytes);
  return parseArtespTarifaLines(lines);
}
