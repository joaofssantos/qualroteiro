/**
 * Overpass API client for OpenStreetMap `barrier=toll_booth` nodes covering
 * all of Brazil (`j-20260916-y9`, Wave 3).
 *
 * **Real volume, checked live** (2026-09-17, `overpass-api.de`): a
 * `node["barrier"="toll_booth"]` query scoped to Brazil's own OSM
 * administrative area (`ISO3166-1=BR`, `admin_level=2`) returned **957
 * nodes** (`out count;`, confirmed against the full `out;` response too —
 * see `specs/002-t5-wave3-osm-toll-ingest/spec.md`). That is well under
 * orientation.md's "poucos milhares" estimate (which was extrapolated from a
 * ~500-node SP-and-surrounding sample) — the real number came in under a
 * thousand, comfortably inside one `[out:json][timeout:180]` request with no
 * pagination needed. Documented here as the real finding it is, not
 * silently reconciled with the estimate.
 *
 * **Area, not bounding box**: `area["ISO3166-1"="BR"][admin_level=2]`
 * resolves Brazil's real OSM administrative boundary relation, per
 * orientation.md decision #6 — same Overpass cost regardless of shape, more
 * precise than a manual lat/lng box (no risk of clipping a border toll booth
 * or over-including a neighbouring country's strip).
 *
 * **Fair use, not a paid API**: a real, contactable `User-Agent` (Overpass's
 * own documented ask of API consumers), a bounded server-side
 * `[timeout:180]` (`OVERPASS_TIMEOUT_SECONDS`), a client-side `AbortController`
 * with headroom above that, and exactly ONE request per ingestion run — no
 * retry loop. A failure (busy server, timeout, malformed response) is
 * surfaced as a thrown `Error` for the caller to log and report, never
 * silently retried in a loop or masked by truncating the query.
 */

export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Identifies this job to Overpass's operators, per their fair-use policy
 * (https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) —
 * a real, contactable identity, not a generic HTTP client default.
 */
export const OVERPASS_USER_AGENT =
  'qualroteiro-data-ingest/0.1 (+https://github.com/joaofssantos/qualroteiro)';

/**
 * Server-side Overpass QL `[timeout:N]`, seconds. 180s comfortably covers a
 * 957-node, whole-country area query (the real run completed well inside
 * this — see the spec's evidence section) while still bounding how long a
 * degraded/busy server can hold the connection open.
 */
export const OVERPASS_TIMEOUT_SECONDS = 180;

/** Client-side `AbortController` timeout — headroom above the server-side
 * `[timeout:...]` so a slow-but-alive server isn't cut off first by the
 * client. */
const CLIENT_TIMEOUT_MS = (OVERPASS_TIMEOUT_SECONDS + 30) * 1000;

/**
 * Builds the Overpass QL query for every `barrier=toll_booth` node inside
 * Brazil's OSM administrative area. `out;` (not `out tags;`) is required —
 * `out tags;` omits `lat`/`lon` entirely for nodes, which this job needs.
 */
export function buildOverpassQuery(timeoutSeconds: number = OVERPASS_TIMEOUT_SECONDS): string {
  return (
    `[out:json][timeout:${timeoutSeconds}];` +
    `area["ISO3166-1"="BR"][admin_level=2]->.br;` +
    `node["barrier"="toll_booth"](area.br);` +
    `out;`
  );
}

/** One `node` element of an Overpass JSON response. */
export interface OverpassNode {
  readonly type: 'node';
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
  readonly tags?: Record<string, string>;
}

interface OverpassJsonResponse {
  readonly elements: readonly (OverpassNode | { readonly type: string })[];
}

/**
 * Runs the Brazil-wide toll-booth query once and returns every `node`
 * element (non-`node` elements, none expected for this query, are filtered
 * out defensively rather than assumed absent).
 *
 * @param fetchImpl Injectable for tests; defaults to global `fetch`.
 * @throws {Error} on a non-2xx HTTP response, or when the body isn't valid
 *   JSON — Overpass returns an HTML "server busy / timeout" error page
 *   (200 or 5xx depending on the failure) in that case, not JSON, which is
 *   surfaced as a distinct, readable error rather than a generic parse
 *   failure or a silently-empty result.
 */
export async function downloadOsmTollBoothNodes(
  url: string = OVERPASS_API_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<OverpassNode[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(buildOverpassQuery())}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Overpass query failed: HTTP ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    let parsed: OverpassJsonResponse;
    try {
      parsed = JSON.parse(text) as OverpassJsonResponse;
    } catch {
      throw new Error(
        `Overpass returned a non-JSON response (likely busy/timeout on their end — ` +
          `this is a real finding to report, not to silently retry around): ` +
          `${text.slice(0, 300)}`,
      );
    }

    return parsed.elements.filter((el): el is OverpassNode => el.type === 'node');
  } finally {
    clearTimeout(timer);
  }
}
