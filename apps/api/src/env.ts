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
