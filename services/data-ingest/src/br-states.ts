/**
 * Brazilian state name -> UF (2-letter) code lookup.
 *
 * `TollPlazaRecord.uf` is a real Postgres `VARCHAR(2)` — a value longer than
 * two characters is a hard database error, not a soft truncation. OSM's
 * `addr:state` tag (when present at all — see `osm-toll-plazas.ts`'s
 * doc-comment on real coverage) carries the state's full Portuguese name
 * (e.g. `"Minas Gerais"`), never the UF code, so it cannot be written
 * directly into that column. This is a small, exact lookup table (27
 * entries, the closed set of Brazilian states + the Federal District) —
 * matched case/diacritic-insensitively — not a geocoding heuristic: it only
 * ever returns a code for a name it recognizes exactly, `undefined`
 * otherwise, so a caller falls back to the documented "unknown" sentinel
 * rather than a guess.
 */

const NAME_TO_UF: ReadonlyMap<string, string> = new Map(
  Object.entries({
    acre: 'AC',
    alagoas: 'AL',
    amapa: 'AP',
    amazonas: 'AM',
    bahia: 'BA',
    ceara: 'CE',
    'distrito federal': 'DF',
    'espirito santo': 'ES',
    goias: 'GO',
    maranhao: 'MA',
    'mato grosso': 'MT',
    'mato grosso do sul': 'MS',
    'minas gerais': 'MG',
    para: 'PA',
    paraiba: 'PB',
    parana: 'PR',
    pernambuco: 'PE',
    piaui: 'PI',
    'rio de janeiro': 'RJ',
    'rio grande do norte': 'RN',
    'rio grande do sul': 'RS',
    rondonia: 'RO',
    roraima: 'RR',
    'santa catarina': 'SC',
    'sao paulo': 'SP',
    sergipe: 'SE',
    tocantins: 'TO',
  }),
);

/** NFKD-normalize + strip diacritics + lowercase + collapse whitespace —
 * same normalization idea as `slug.ts`, kept local since this only ever
 * feeds the lookup above. */
function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolves a Brazilian state's full name (any casing/accenting) to its UF
 * code, or `undefined` if `stateName` is `undefined` or not an exact match
 * for one of the 27 real state names.
 */
export function ufFromStateName(stateName: string | undefined): string | undefined {
  if (stateName === undefined) return undefined;
  return NAME_TO_UF.get(normalize(stateName));
}
