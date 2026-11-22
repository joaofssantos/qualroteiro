/**
 * Environment reading for the api unit.
 *
 * ORS_* are this unit's own vars. DATABASE_URL / REDIS_URL / VALHALLA_URL /
 * PHOTON_URL are owned and injected by `qualroteiro/root` and are deliberately
 * NOT read here — F1 uses the managed provider and has no persistence.
 */

import { readFileSync } from 'node:fs';

export interface OrsEnv {
  readonly apiKey: string;
  readonly baseUrl: string;
}

export const DEFAULT_ORS_BASE_URL = 'https://api.openrouteservice.org';

/**
 * Read the browser origins allowed to call the API.
 *
 * `undefined` deliberately keeps the permissive local-development behaviour
 * of `@fastify/cors`. In production, set `CORS_ORIGIN` to the Vercel origin
 * (or a comma-separated list of preview/production origins) instead.
 */
export type CorsOrigin = string | RegExp;

/**
 * Canonical form of an origin entry: no trailing slash, lowercase scheme and
 * host (both case-insensitive per RFC 3986), so a CORS_ORIGIN written with a
 * trailing slash or capitals still matches the browser's real `Origin`.
 */
function normalizeOrigin(entry: string): string {
  const trimmed = entry.replace(/\/+$/, '');
  const match = /^([^:/]+:\/\/[^/?#]*)(.*)$/.exec(trimmed);
  return match ? `${match[1]!.toLowerCase()}${match[2]!}` : trimmed;
}

function previewPattern(origin: string): RegExp {
  const wildcardCount = [...origin].filter((character) => character === '*').length;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`CORS_ORIGIN contains an invalid preview pattern: ${origin}`);
  }

  const labels = url.hostname.split('.');
  // The '*' must live in the first host label and follow a non-empty literal
  // prefix (e.g. `qualroteiro-*`), so `https://*.vercel.app` can never open
  // the API to every project on the shared domain.
  const wildcardAt = labels[0]?.indexOf('*') ?? -1;
  if (
    wildcardCount !== 1 ||
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    wildcardAt < 1 ||
    labels.length < 3
  ) {
    throw new Error(
      `CORS_ORIGIN preview patterns must have a literal prefix before a single '*' in the first host label (e.g. https://qualroteiro-*.vercel.app): ${origin}`,
    );
  }

  // Escape every literal character before replacing the single allowed wildcard.
  // This keeps a suffix such as `.evil.com` from matching a Vercel preview.
  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace('\\*', '[a-z0-9-]+')}$`);
}

export function readCorsOrigins(env: NodeJS.ProcessEnv = process.env): readonly CorsOrigin[] | undefined {
  const rawValue = env['CORS_ORIGIN'];
  if (rawValue === undefined) return undefined;

  const origins = rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map(normalizeOrigin);

  if (origins.length === 0) {
    throw new Error(
      'CORS_ORIGIN is set but contains no origins. Unset it for permissive local development or list at least one origin.',
    );
  }
  return origins.map((origin) => (origin.includes('*') ? previewPattern(origin) : origin));
}

/**
 * Read the OpenRouteService configuration.
 *
 * @throws {Error} at startup if `ORS_API_KEY` is absent — failing loudly in the
 * composition root beats every request failing later with a confusing 502.
 */
export function readOrsEnv(env: NodeJS.ProcessEnv = process.env): OrsEnv {
  const apiKey = env['ORS_API_KEY']?.trim();

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      'ORS_API_KEY is not set. Copy apps/api/.env.example and provide an OpenRouteService API key.',
    );
  }

  return {
    apiKey,
    baseUrl: env['ORS_BASE_URL']?.trim() || DEFAULT_ORS_BASE_URL,
  };
}

export interface ClerkEnv {
  readonly secretKey: string;
}

/**
 * Read the Clerk backend configuration.
 *
 * Only called by `server.ts`. The returned key is passed straight to the Clerk
 * adapter and must never be logged, echoed in an error, or included in a
 * response — the thrown message below deliberately names the variable and not
 * its value.
 *
 * @throws {Error} at startup if `CLERK_SECRET_KEY` is absent. Same reasoning
 * as {@link readOrsEnv}: failing in the composition root beats every `/trips*`
 * request failing later with a confusing 401.
 */
export function readClerkEnv(env: NodeJS.ProcessEnv = process.env): ClerkEnv {
  const secretKey = env['CLERK_SECRET_KEY']?.trim();

  if (secretKey === undefined || secretKey.length === 0) {
    throw new Error(
      'CLERK_SECRET_KEY is not set. Copy apps/api/.env.example and provide the ' +
        'Clerk backend secret key from the Clerk dashboard.',
    );
  }

  return { secretKey };
}

export interface GooglePlacesEnv {
  readonly apiKey: string;
  /** The circuit breaker's monthly ceiling for `places-nearby-search`. */
  readonly searchMonthlyCap: number;
}

/**
 * Below Google's free tier (5,000 Nearby Search calls/month) with a safety
 * margin, so the breaker trips while the month is still free — see
 * `apps/api/specs/006-g1-google-places/spec.md`.
 */
export const DEFAULT_GOOGLE_PLACES_SEARCH_MONTHLY_CAP = 4500;

/**
 * Read the Google Places configuration.
 *
 * @throws {Error} at startup if `GOOGLE_PLACES_API_KEY` is absent, or if
 * `GOOGLE_PLACES_SEARCH_MONTHLY_CAP` is present but not a positive number.
 * Same reasoning as {@link readOrsEnv}: failing loudly in the composition
 * root beats every `/places/nearby` request failing later with a confusing
 * 502 — or, worse for a cap that silently parsed as `NaN`, a circuit breaker
 * that never trips.
 */
export function readGooglePlacesEnv(env: NodeJS.ProcessEnv = process.env): GooglePlacesEnv {
  const apiKey = env['GOOGLE_PLACES_API_KEY']?.trim();

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY is not set. Copy apps/api/.env.example and provide a Google Places API key.',
    );
  }

  const rawCap = env['GOOGLE_PLACES_SEARCH_MONTHLY_CAP']?.trim();
  let searchMonthlyCap = DEFAULT_GOOGLE_PLACES_SEARCH_MONTHLY_CAP;
  if (rawCap !== undefined && rawCap.length > 0) {
    const parsed = Number(rawCap);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(
        `GOOGLE_PLACES_SEARCH_MONTHLY_CAP must be a positive number, got '${rawCap}'.`,
      );
    }
    searchMonthlyCap = parsed;
  }

  return { apiKey, searchMonthlyCap };
}

/**
 * Parse a minimal `.env`-style document: `KEY=VALUE` lines, blank lines and
 * `#`-comments ignored, optional matching single/double quotes stripped from
 * the value. No interpolation, no multiline values — apps/api's `.env` only
 * ever needs `KEY=VALUE`, and a hand-rolled parser here keeps this unit free
 * of a dotenv dependency for two lines of config.
 */
function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (key !== '') result[key] = value;
  }

  return result;
}

/**
 * Load a `.env`-style file's variables into `target`, without overwriting
 * keys `target` already has.
 *
 * `server.ts` (the composition root) calls this against `process.env` before
 * {@link readOrsEnv} so a developer's `apps/api/.env` is actually picked up —
 * previously nothing loaded it, so the server refused to start even with a
 * valid key on disk. A real deployment that injects `ORS_API_KEY` directly
 * (no `.env` file) is unaffected: an absent file is a silent no-op, and an
 * already-set variable always wins over the file.
 */
export function loadDotEnvInto(target: NodeJS.ProcessEnv, path = '.env'): void {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  for (const [key, value] of Object.entries(parseEnvFile(contents))) {
    if (target[key] === undefined) {
      target[key] = value;
    }
  }
}
