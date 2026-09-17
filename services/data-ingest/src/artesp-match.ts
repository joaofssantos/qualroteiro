/**
 * Matches ARTESP toll-plaza rows (`artesp-pdf.ts`) against `TollPlazaRecord`
 * rows already in Postgres with `source: 'osm'`.
 *
 * ## Why NOT "same rodovia as a hard filter" — a real finding, not the
 * example orientation.md sketched
 *
 * orientation.md's own example heuristic was "normalização + distância de
 * string + mesma rodovia como filtro duro, ou equivalente" (explicitly
 * leaving room for an equivalent). Real data ended that particular example
 * before this module could even be written: queried directly against the
 * real 489 `source: 'osm'` rows already in Postgres (Wave 3 of
 * `j-20260916-y9`, merged) —
 *
 * ```sql
 * select highway, uf, count(*) from "TollPlazaRecord"
 *   where source = 'osm' group by highway, uf;
 * -- highway = 'Não informado (OSM)', uf = 'BR'  |  489   (100%, every row)
 * ```
 *
 * `osm-toll-plazas.ts`'s own doc-comment already predicted this (`ref` tag
 * coverage: 26/957 Overpass nodes, 3%) — confirmed here against the REAL
 * ingested rows: it rounds down to **zero usable rows**. A hard filter on
 * `highway` would therefore reject every single ARTESP row before matching
 * even starts. Two real, verified signals replace it:
 *
 * 1. **A coarse São Paulo bounding box on OSM's `lat`/`lng`** (real,
 *    accurate coordinates — unlike `highway`/`uf`, this is the one thing
 *    `osm-toll-plazas.ts` promises to be accurate). The real 489 rows span
 *    all of Brazil (confirmed: `lat` -31.85..-4.56, `lng` -63.65..-34.94,
 *    concessionaires from Bahia/Mato Grosso/Rio/Tocantins mixed in) — only
 *    262/489 (54%) fall inside a rough SP box (`lat` -25.3..-19.7, `lng`
 *    -53.3..-44.0). This is a bounding box, not São Paulo's real polygon
 *    border (no shapefile dependency for a V1 audit job), so it is a coarse,
 *    deliberately generous filter — a real plaza right at the state
 *    boundary could fall just outside it. Documented, not hidden.
 * 2. **Fuzzy plaza-name matching** ({@link normalizePlazaName} +
 *    {@link stringSimilarity}) is the actual matching signal — ARTESP's
 *    `plazaName` (e.g. `"PERUS"`) against OSM's `name` (e.g. `"Pedágio Perus
 *    (sentido Sul)"`, from the `note`/`name` tag — see `osm-toll-plazas.ts`).
 *    `concessionaire` is used only as a small scoring bonus, NOT a hard
 *    filter — real ARTESP legal names ("Concessionária do Sistema
 *    Anhanguera-Bandeirantes S.A. - AUTOBAN") and real OSM `operator` tags
 *    ("CCR AutoBAn") diverge enough (rebrands — "Motiva" is CCR's 2025 rename
 *    — group-vs-SPE naming, etc.) that requiring them to agree would produce
 *    false negatives a plain substring/alias table can't safely rule out.
 *
 * `matchArtespToOsm` is therefore: SP-bbox filter -> greedy best-score
 * bipartite pairing by name similarity (+ a small concessionaire-overlap
 * bonus) -> a score-threshold cutoff. Below the threshold (or with no SP-bbox
 * candidate at all) an ARTESP row is reported unmatched, never force-matched
 * to the nearest-but-wrong candidate — a false "sem match" is an honest,
 * auditable outcome; a false positive pairing is not.
 */

import type { AxleCategory, TariffByAxleCategory } from '@qualroteiro/tolls';

import type { ArtespTollRow } from './artesp-pdf.js';

/**
 * A `source: 'osm'` `TollPlazaRecord` row, narrowed to exactly the fields
 * this module reads — same "narrow interface, not the generated Prisma
 * model" pattern as `ingest.ts`'s `TollPlazaUpsertClient`.
 */
export interface OsmTollPlazaCandidate {
  readonly id: string;
  readonly concessionaire: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  /** `null` when the row's `charge` tag never parsed (see
   * `osm-toll-plazas.ts`) — `artesp-compare.ts` reports these as "sem
   * tarifa OSM para comparar" rather than skipping the row outright. */
  readonly tariff: TariffByAxleCategory | null;
}

/**
 * Coarse São Paulo bounding box — see this module's doc-comment for why a
 * box (not the real state polygon) is an intentional, documented V1
 * simplification.
 */
export const SP_BBOX = {
  minLat: -25.3,
  maxLat: -19.7,
  minLng: -53.3,
  maxLng: -44.0,
} as const;

export function isWithinSpBoundingBox(lat: number, lng: number): boolean {
  return lat >= SP_BBOX.minLat && lat <= SP_BBOX.maxLat && lng >= SP_BBOX.minLng && lng <= SP_BBOX.maxLng;
}

/** Lane/direction/entrance suffixes and free-text noise real ARTESP and OSM
 * plaza names both carry in different shapes — stripped before comparing.
 * e.g. ARTESP `"CAIEIRAS *"` -> `"caieiras"`; OSM `"Pedágio Perus (sentido
 * Sul)"` -> `"perus"`; OSM `"Osasco - 1"` -> `"osasco"`. */
const NOISE_WORDS_RE =
  /\b(pedagio|praca|portico|sentido|norte|sul|leste|oeste|capital|interior|bloqueio|externa|interna|pista)\b/g;

/**
 * Normalizes a plaza name for fuzzy comparison: strip diacritics (same
 * NFKD approach as `slug.ts`), lowercase, drop parenthetical content and
 * trailing lane/number suffixes (`"- 1"`, `"- P5"`, `"*"`), drop common
 * noise words, collapse to single-spaced words.
 */
export function normalizePlazaName(raw: string): string {
  const withoutDiacritics = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return withoutDiacritics
    .replace(/\([^)]*\)/g, ' ') // "(sentido Sul)", "(TATUÍ)"
    .replace(/[*;].*$/g, ' ') // "CAIEIRAS *" and "Aracruz - 1; BR-101 km 172"
    .replace(/-\s*p?\d+[a-z]?\s*$/i, ' ') // trailing "- 1", "- P5", "-2"
    .replace(/\bkm[-\s]?\d+\b/g, ' ') // "KM-118"
    .replace(NOISE_WORDS_RE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same idea as {@link normalizePlazaName}, for the concessionaire-overlap
 * scoring bonus — much lighter touch (no noise-word list), since it only
 * needs to catch a shared distinctive token (e.g. "autoban", "ecovias",
 * "intervias"), not produce a clean canonical name. */
export function normalizeConcessionaire(raw: string): readonly string[] {
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const STOPWORDS = new Set([
    'sa',
    's',
    'a',
    'de',
    'do',
    'da',
    'dos',
    'das',
    'concessionaria',
    'concessionarias',
    'sistema',
    'rodovia',
    'rodovias',
    'ccr',
  ]);
  return normalized.split(' ').filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/** Plain Levenshtein edit distance (no dependency — the strings involved
 * here are short plaza names, so an O(n*m) DP table is more than fast
 * enough and keeps this package's dependency surface small). */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, (_unused, row) => {
    const line = new Array<number>(cols).fill(0);
    line[0] = row;
    return line;
  });
  const firstRow = distances[0];
  if (firstRow) {
    for (let col = 0; col <= b.length; col++) firstRow[col] = col;
  }

  for (let row = 1; row <= a.length; row++) {
    for (let col = 1; col <= b.length; col++) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      const currentRow = distances[row];
      const prevRow = distances[row - 1];
      if (!currentRow || !prevRow) continue;
      currentRow[col] = Math.min(
        (prevRow[col] ?? 0) + 1, // deletion
        (currentRow[col - 1] ?? 0) + 1, // insertion
        (prevRow[col - 1] ?? 0) + cost, // substitution
      );
    }
  }

  return distances[a.length]?.[b.length] ?? Math.max(a.length, b.length);
}

/** Normalized similarity in `[0, 1]` — `1` for identical strings, `0` for
 * completely different ones (edit distance capped at the longer string's
 * length). Two empty strings are defined as `0` (no signal), not `1`. */
export function stringSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 0;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : 1 - distance / maxLen;
}

/** Small additive bonus (out of the same `[0,1]` scale as
 * {@link stringSimilarity}) when the ARTESP and OSM concessionaire labels
 * share at least one distinctive normalized token (e.g. both contain
 * "autoban", or both contain "ecovias"). Capped low deliberately — this is a
 * tiebreaker, not a filter (see this module's doc-comment for why
 * concessionaire can't safely be a hard filter). */
const CONCESSIONAIRE_BONUS = 0.15;

function concessionaireOverlapBonus(artespConcessionaire: string, osmConcessionaire: string): number {
  const artespTokens = new Set(normalizeConcessionaire(artespConcessionaire));
  const osmTokens = normalizeConcessionaire(osmConcessionaire);
  const sharesToken = osmTokens.some((token) => artespTokens.has(token));
  return sharesToken ? CONCESSIONAIRE_BONUS : 0;
}

/** A candidate pairing and its score, before the threshold cutoff and
 * greedy bipartite resolution in {@link matchArtespToOsm}. */
interface ScoredPair {
  readonly artespIndex: number;
  readonly osmIndex: number;
  readonly score: number;
}

export interface ArtespOsmMatch {
  readonly artesp: ArtespTollRow;
  readonly osm: OsmTollPlazaCandidate;
  readonly score: number;
}

export interface ArtespMatchResult {
  readonly matches: readonly ArtespOsmMatch[];
  readonly unmatchedArtesp: readonly ArtespTollRow[];
  readonly unmatchedOsm: readonly OsmTollPlazaCandidate[];
  /** OSM rows dropped before matching even started because their `lat`/`lng`
   * fell outside {@link SP_BBOX} — informational, not an error; these are
   * real plazas, just not ones ARTESP (a São Paulo state regulator) could
   * ever have a row for. */
  readonly osmOutsideSpBoundingBox: number;
}

export interface MatchOptions {
  /** Minimum combined score (name similarity + concessionaire bonus) to
   * accept a pairing. Default `0.55`: chosen empirically against the real
   * document's own plaza names — e.g. `normalizePlazaName("PERUS")` = `"perus"`
   * vs `normalizePlazaName("Pedágio Perus (sentido Sul)")` = `"perus"`
   * (`stringSimilarity` = `1.0`, comfortably above); `"CAIEIRAS *"` = `"caieiras"`
   * vs OSM `"Pedágio Caieiras (sentido Capital/Sul)"` = `"caieiras"` (also
   * `1.0`). Lower than ~0.5 starts accepting unrelated same-length short
   * names (a risk for this dataset's many short city-name plazas); higher
   * than ~0.7 starts rejecting genuine matches with real typos on the OSM
   * side (confirmed present — e.g. `"Aparecida doTabuado"` vs `"Aparecida do
   * Tabuado"`, a real pair in the live data, one missing a space).
   * Adjustable per call; documented here rather than hardcoded so a future
   * tuning pass has one place to look. */
  readonly scoreThreshold?: number;
}

const DEFAULT_SCORE_THRESHOLD = 0.55;

/**
 * Matches ARTESP rows against OSM `source: 'osm'` candidates — see this
 * module's doc-comment for the full heuristic and why it deviates from
 * orientation.md's own "same rodovia" example.
 *
 * Algorithm: SP-bbox filter -> score every (ARTESP row, OSM candidate) pair
 * within the bbox -> sort all pairs scoring at/above the threshold,
 * descending -> greedily accept the highest-scoring pair first, then the
 * next that doesn't reuse an already-claimed row on either side, and so on
 * (a simple greedy bipartite match, not a globally-optimal assignment —
 * documented, not hidden: for this dataset's size (136 x ~262) the
 * difference is immaterial, and greedy is trivially auditable by reading
 * the score list top to bottom).
 */
export function matchArtespToOsm(
  artespRows: readonly ArtespTollRow[],
  osmCandidates: readonly OsmTollPlazaCandidate[],
  options: MatchOptions = {},
): ArtespMatchResult {
  const scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;

  const inSpBbox: OsmTollPlazaCandidate[] = [];
  let osmOutsideSpBoundingBox = 0;
  for (const candidate of osmCandidates) {
    if (isWithinSpBoundingBox(candidate.lat, candidate.lng)) {
      inSpBbox.push(candidate);
    } else {
      osmOutsideSpBoundingBox++;
    }
  }

  const artespNormalized = artespRows.map((row) => normalizePlazaName(row.plazaName));
  const osmNormalized = inSpBbox.map((candidate) => normalizePlazaName(candidate.name));

  const scoredPairs: ScoredPair[] = [];
  for (let artespIndex = 0; artespIndex < artespRows.length; artespIndex++) {
    const artespRow = artespRows[artespIndex];
    const artespName = artespNormalized[artespIndex];
    if (!artespRow || artespName === undefined || artespName === '') continue;

    for (let osmIndex = 0; osmIndex < inSpBbox.length; osmIndex++) {
      const osmCandidate = inSpBbox[osmIndex];
      const osmName = osmNormalized[osmIndex];
      if (!osmCandidate || osmName === undefined || osmName === '') continue;

      const nameScore = stringSimilarity(artespName, osmName);
      const bonus = concessionaireOverlapBonus(artespRow.concessionaire, osmCandidate.concessionaire);
      const score = Math.min(1, nameScore + bonus);
      if (score >= scoreThreshold) {
        scoredPairs.push({ artespIndex, osmIndex, score });
      }
    }
  }

  scoredPairs.sort((a, b) => b.score - a.score);

  const claimedArtesp = new Set<number>();
  const claimedOsm = new Set<number>();
  const matches: ArtespOsmMatch[] = [];

  for (const pair of scoredPairs) {
    if (claimedArtesp.has(pair.artespIndex) || claimedOsm.has(pair.osmIndex)) continue;
    const artespRow = artespRows[pair.artespIndex];
    const osmCandidate = inSpBbox[pair.osmIndex];
    if (!artespRow || !osmCandidate) continue;
    claimedArtesp.add(pair.artespIndex);
    claimedOsm.add(pair.osmIndex);
    matches.push({ artesp: artespRow, osm: osmCandidate, score: pair.score });
  }

  const unmatchedArtesp = artespRows.filter((_row, index) => !claimedArtesp.has(index));
  const unmatchedOsm = inSpBbox.filter((_candidate, index) => !claimedOsm.has(index));

  return { matches, unmatchedArtesp, unmatchedOsm, osmOutsideSpBoundingBox };
}

// Re-exported so callers of this module don't need a separate
// `@qualroteiro/tolls` import just for the axle-category type used across
// `artesp-compare.ts`'s public surface.
export type { AxleCategory, TariffByAxleCategory };
